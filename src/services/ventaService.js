const db = require("../config/db");
const { redondear, numero } = require("../helpers/dinero");
const configService = require("./configService");

class ErrorVenta extends Error {}

function proximoNumero() {
  const c = configService.todo();
  const pv = String(c.punto_venta || 1).padStart(4, "0");
  const n = Number(c.proximo_numero || 1);
  db.prepare("UPDATE configuracion SET valor = ? WHERE clave = 'proximo_numero'").run(String(n + 1));
  return `${pv}-${String(n).padStart(8, "0")}`;
}

// Registra la venta completa en UNA transacción: si algo falla no se guarda nada.
// Los precios y costos se leen de la base (nunca se confía en el navegador).
const crear = db.transaction(({ usuarioId, cajaId, items, descuento, pagos, clienteId, notas }) => {
  if (!Array.isArray(items) || !items.length) throw new ErrorVenta("La venta no tiene productos");
  const cfg = configService.todo();
  const permitirNegativo = cfg.stock_negativo === "1";

  const getProducto = db.prepare("SELECT * FROM productos WHERE id = ? AND activo = 1");
  const lineas = [];
  const acumulado = new Map(); // por si el mismo producto viene en dos líneas
  let subtotal = 0;

  for (const it of items) {
    const cantidad = numero(it.cantidad);
    if (!(cantidad > 0)) throw new ErrorVenta("Cantidad inválida");
    const p = getProducto.get(it.producto_id);
    if (!p) throw new ErrorVenta("Un producto ya no está disponible");
    const total = (acumulado.get(p.id) || 0) + cantidad;
    acumulado.set(p.id, total);
    if (!permitirNegativo && total > p.stock) {
      throw new ErrorVenta(`Stock insuficiente de "${p.nombre}" (disponible: ${p.stock})`);
    }
    const precio = p.precio;
    const sub = redondear(precio * cantidad);
    subtotal += sub;
    lineas.push({ p, cantidad, precio, sub });
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

  const numeroFactura = proximoNumero();
  const venta = db.prepare(`
    INSERT INTO ventas (numero, caja_id, usuario_id, cliente_id, subtotal, descuento, total,
                        pago_efectivo, pago_tarjeta, pago_transferencia, recibido, vuelto, notas)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    numeroFactura, cajaId, usuarioId, clienteId || null, subtotal, descuento, total,
    redondear(ef - vuelto), ta, tr, recibido, vuelto, notas || null
  );
  const ventaId = venta.lastInsertRowid;

  const insItem = db.prepare(`
    INSERT INTO venta_items (venta_id, producto_id, codigo, descripcion, cantidad, precio_unitario, costo_unitario, subtotal)
    VALUES (?,?,?,?,?,?,?,?)`);
  const bajarStock = db.prepare("UPDATE productos SET stock = stock - ?, actualizado_en = datetime('now','localtime') WHERE id = ?");
  const leerStock = db.prepare("SELECT stock FROM productos WHERE id = ?");
  const insMov = db.prepare(`
    INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id)
    VALUES (?, 'venta', ?, ?, ?, ?)`);

  for (const l of lineas) {
    insItem.run(ventaId, l.p.id, l.p.codigo_barras || l.p.codigo_interno, l.p.nombre, l.cantidad, l.precio, l.p.costo, l.sub);
    bajarStock.run(l.cantidad, l.p.id); // ← descuenta el stock
    insMov.run(l.p.id, -l.cantidad, leerStock.get(l.p.id).stock, numeroFactura, usuarioId);
  }
  return { id: ventaId, numero: numeroFactura, total, vuelto };
});

// Anular: vuelve el stock y la venta deja de contar en los totales
const anular = db.transaction((ventaId, usuarioId, motivo) => {
  const v = db.prepare("SELECT * FROM ventas WHERE id = ?").get(ventaId);
  if (!v) throw new ErrorVenta("Venta inexistente");
  if (v.estado === "anulada") throw new ErrorVenta("La venta ya estaba anulada");
  const caja = db.prepare("SELECT estado FROM cajas WHERE id = ?").get(v.caja_id);
  if (caja.estado !== "abierta") throw new ErrorVenta("Solo se pueden anular ventas de la caja abierta (el turno ya fue cerrado)");

  const items = db.prepare("SELECT * FROM venta_items WHERE venta_id = ?").all(ventaId);
  const subir = db.prepare("UPDATE productos SET stock = stock + ?, actualizado_en = datetime('now','localtime') WHERE id = ?");
  const leer = db.prepare("SELECT stock FROM productos WHERE id = ?");
  const mov = db.prepare("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, referencia, nota, usuario_id) VALUES (?, 'anulacion', ?, ?, ?, ?, ?)");
  for (const it of items) {
    if (!it.producto_id) continue;
    subir.run(it.cantidad, it.producto_id);
    mov.run(it.producto_id, it.cantidad, leer.get(it.producto_id).stock, v.numero, motivo, usuarioId);
  }
  db.prepare("UPDATE ventas SET estado='anulada', anulada_en=datetime('now','localtime'), anulada_por=?, motivo_anulacion=? WHERE id=?")
    .run(usuarioId, motivo, ventaId);
});

const obtener = (id) => {
  const v = db.prepare(`
    SELECT v.*, u.nombre AS cajero, c.nombre AS cliente, c.documento AS cliente_doc
    FROM ventas v JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id WHERE v.id = ?`).get(id);
  if (v) v.items = db.prepare("SELECT * FROM venta_items WHERE venta_id = ? ORDER BY id").all(id);
  return v;
};

const listar = ({ desde, hasta, q, estado }) => {
  const where = ["v.fecha_dia BETWEEN ? AND ?"];
  const params = [desde, hasta];
  if (estado) { where.push("v.estado = ?"); params.push(estado); }
  if (q) { where.push("(v.numero LIKE ? OR c.nombre LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  return db.prepare(`
    SELECT v.*, u.nombre AS cajero, c.nombre AS cliente FROM ventas v
    JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE ${where.join(" AND ")} ORDER BY v.id DESC LIMIT 500`).all(...params);
};

module.exports = { crear, anular, obtener, listar, ErrorVenta };
