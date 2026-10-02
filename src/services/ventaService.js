const db = require("../config/db");
const { redondear, numero } = require("../helpers/dinero");
const configService = require("./configService");

class ErrorVenta extends Error {}

// Toma el próximo número de factura (la fila queda bloqueada hasta el commit)
async function proximoNumero(t) {
  const c = Object.fromEntries((await t.todos("SELECT clave, valor FROM configuracion WHERE clave IN ('punto_venta','proximo_numero') FOR UPDATE")).map((r) => [r.clave, r.valor]));
  const pv = String(c.punto_venta || 1).padStart(4, "0");
  const n = Number(c.proximo_numero || 1);
  await t.run("UPDATE configuracion SET valor = ? WHERE clave = 'proximo_numero'", [String(n + 1)]);
  return `${pv}-${String(n).padStart(8, "0")}`;
}

// Registra la venta completa en UNA transacción: si algo falla no se guarda nada.
// Los precios y costos se leen de la base (nunca se confía en el navegador).
const crear = ({ usuarioId, cajaId, items, descuento, pagos, clienteId, notas }) =>
  db.transaccion(async (t) => {
    if (!Array.isArray(items) || !items.length) throw new ErrorVenta("La venta no tiene productos");
    const cfg = await configService.todo(t);
    const permitirNegativo = cfg.stock_negativo === "1";

    const lineas = [];
    const acumulado = new Map(); // por si el mismo producto viene en dos líneas
    let subtotal = 0;

    // Se ordenan por id para bloquear siempre en el mismo orden (evita bloqueos cruzados entre cajas)
    const ordenados = [...items].sort((a, b) => Number(a.producto_id) - Number(b.producto_id));
    for (const it of ordenados) {
      const cantidad = numero(it.cantidad);
      if (!(cantidad > 0)) throw new ErrorVenta("Cantidad inválida");
      const p = await t.uno("SELECT * FROM productos WHERE id = ? AND activo = 1 FOR UPDATE", [Number(it.producto_id)]);
      if (!p) throw new ErrorVenta("Un producto ya no está disponible");
      const total = (acumulado.get(p.id) || 0) + cantidad;
      acumulado.set(p.id, total);
      if (!permitirNegativo && total > p.stock) {
        throw new ErrorVenta(`Stock insuficiente de "${p.nombre}" (disponible: ${p.stock})`);
      }
      const sub = redondear(p.precio * cantidad);
      subtotal += sub;
      lineas.push({ p, cantidad, precio: p.precio, sub });
    }
    subtotal = redondear(subtotal);

    descuento = redondear(Math.max(0, numero(descuento) || 0));
    const maxDesc = redondear((subtotal * Number(cfg.descuento_maximo || 100)) / 100);
    if (descuento > maxDesc) throw new ErrorVenta(`El descuento máximo permitido es ${cfg.descuento_maximo}%`);
    const total = redondear(subtotal - descuento);

    const ef = redondear(Math.max(0, numero(pagos?.efectivo) || 0));
    const ta = redondear(Math.max(0, numero(pagos?.tarjeta) || 0));
    const tr = redondear(Math.max(0, numero(pagos?.transferencia) || 0));
    const recibido = redondear(ef + ta + tr);
    if (recibido < total) throw new ErrorVenta("El pago no alcanza para cubrir el total");
    const vuelto = redondear(recibido - total);
    if (vuelto > ef) throw new ErrorVenta("El vuelto solo puede salir del efectivo recibido");

    const numeroFactura = await proximoNumero(t);
    const venta = await t.run(
      `INSERT INTO ventas (numero, caja_id, usuario_id, cliente_id, fecha_dia, subtotal, descuento, total,
                           pago_efectivo, pago_tarjeta, pago_transferencia, recibido, vuelto, notas)
       VALUES (?,?,?,?,CURDATE(),?,?,?,?,?,?,?,?,?)`,
      [numeroFactura, cajaId, usuarioId, clienteId || null, subtotal, descuento, total,
       redondear(ef - vuelto), ta, tr, recibido, vuelto, notas || null]);
    const ventaId = venta.insertId;

    for (const l of lineas) {
      await t.run(
        `INSERT INTO venta_items (venta_id, producto_id, codigo, descripcion, cantidad, precio_unitario, costo_unitario, subtotal)
         VALUES (?,?,?,?,?,?,?,?)`,
        [ventaId, l.p.id, l.p.codigo_barras || l.p.codigo_interno, l.p.nombre, l.cantidad, l.precio, l.p.costo, l.sub]);
      await t.run("UPDATE productos SET stock = stock - ? WHERE id = ?", [l.cantidad, l.p.id]); // ← descuenta el stock
      const { stock } = await t.uno("SELECT stock FROM productos WHERE id = ?", [l.p.id]);
      await t.run(
        "INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id) VALUES (?, 'venta', ?, ?, ?, ?)",
        [l.p.id, -l.cantidad, stock, numeroFactura, usuarioId]);
    }
    return { id: ventaId, numero: numeroFactura, total, vuelto };
  });

// Anular: vuelve el stock y la venta deja de contar en los totales
const anular = (ventaId, usuarioId, motivo) =>
  db.transaccion(async (t) => {
    const v = await t.uno("SELECT * FROM ventas WHERE id = ? FOR UPDATE", [ventaId]);
    if (!v) throw new ErrorVenta("Venta inexistente");
    if (v.estado === "anulada") throw new ErrorVenta("La venta ya estaba anulada");
    const caja = await t.uno("SELECT estado FROM cajas WHERE id = ?", [v.caja_id]);
    if (caja.estado !== "abierta") throw new ErrorVenta("Solo se pueden anular ventas de la caja abierta (el turno ya fue cerrado)");

    const items = await t.todos("SELECT * FROM venta_items WHERE venta_id = ? ORDER BY producto_id", [ventaId]);
    for (const it of items) {
      if (!it.producto_id) continue;
      await t.run("UPDATE productos SET stock = stock + ? WHERE id = ?", [it.cantidad, it.producto_id]);
      const { stock } = await t.uno("SELECT stock FROM productos WHERE id = ?", [it.producto_id]);
      await t.run(
        "INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, referencia, nota, usuario_id) VALUES (?, 'anulacion', ?, ?, ?, ?, ?)",
        [it.producto_id, it.cantidad, stock, v.numero, motivo, usuarioId]);
    }
    await t.run("UPDATE ventas SET estado='anulada', anulada_en=NOW(), anulada_por=?, motivo_anulacion=? WHERE id=?", [usuarioId, motivo, ventaId]);
  });

const obtener = async (id) => {
  const v = await db.uno(
    `SELECT v.*, u.nombre AS cajero, c.nombre AS cliente, c.documento AS cliente_doc
     FROM ventas v JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id WHERE v.id = ?`, [id]);
  if (v) v.items = await db.todos("SELECT * FROM venta_items WHERE venta_id = ? ORDER BY id", [id]);
  return v;
};

const listar = ({ desde, hasta, q, estado }) => {
  const where = ["v.fecha_dia BETWEEN ? AND ?"];
  const params = [desde, hasta];
  if (estado) { where.push("v.estado = ?"); params.push(estado); }
  if (q) { where.push("(v.numero LIKE ? OR c.nombre LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  return db.todos(
    `SELECT v.*, u.nombre AS cajero, c.nombre AS cliente FROM ventas v
     JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE ${where.join(" AND ")} ORDER BY v.id DESC LIMIT 500`, params);
};

module.exports = { crear, anular, obtener, listar, ErrorVenta };
