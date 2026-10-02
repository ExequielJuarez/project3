const db = require("../config/db");
const { redondear, numero } = require("../helpers/dinero");

// Ingreso de mercadería: suma stock y actualiza el costo (y opcionalmente el precio)
const crear = ({ usuarioId, proveedorId, comprobante, notas, items }) =>
  db.transaccion(async (t) => {
    if (!Array.isArray(items) || !items.length) throw new Error("La compra no tiene productos");
    let total = 0;
    const lineas = [];
    for (const it of items) {
      const cantidad = numero(it.cantidad), costo = numero(it.costo);
      if (!(cantidad > 0) || !(costo >= 0)) throw new Error("Cantidad o costo inválido");
      const p = await t.uno("SELECT id FROM productos WHERE id = ?", [Number(it.producto_id)]);
      if (!p) throw new Error("Producto inexistente");
      const sub = redondear(cantidad * costo);
      total += sub;
      const precio = it.precio !== undefined && it.precio !== "" && it.precio !== null ? numero(it.precio) : null;
      lineas.push({ id: p.id, cantidad, costo, sub, precio });
    }
    total = redondear(total);
    const compra = await t.run("INSERT INTO compras (proveedor_id, usuario_id, comprobante, total, notas) VALUES (?,?,?,?,?)",
      [proveedorId || null, usuarioId, comprobante || null, total, notas || null]);
    const cid = compra.insertId;
    for (const l of lineas) {
      await t.run("INSERT INTO compra_items (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES (?,?,?,?,?)", [cid, l.id, l.cantidad, l.costo, l.sub]);
      await t.run("UPDATE productos SET stock = stock + ?, costo = ? WHERE id = ?", [l.cantidad, redondear(l.costo), l.id]);
      if (l.precio !== null && l.precio >= 0) await t.run("UPDATE productos SET precio = ? WHERE id = ?", [redondear(l.precio), l.id]);
      const { stock } = await t.uno("SELECT stock FROM productos WHERE id = ?", [l.id]);
      await t.run("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id) VALUES (?, 'compra', ?, ?, ?, ?)",
        [l.id, l.cantidad, stock, `Compra #${cid}`, usuarioId]);
    }
    return cid;
  });

const listar = () =>
  db.todos(`SELECT c.*, p.nombre AS proveedor, u.nombre AS usuario FROM compras c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.id DESC LIMIT 200`);

const obtener = async (id) => {
  const c = await db.uno(
    `SELECT c.*, p.nombre AS proveedor, u.nombre AS usuario FROM compras c
     LEFT JOIN proveedores p ON p.id = c.proveedor_id JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ?`, [id]);
  if (c) c.items = await db.todos("SELECT i.*, p.nombre FROM compra_items i JOIN productos p ON p.id = i.producto_id WHERE compra_id = ?", [id]);
  return c;
};

module.exports = { crear, listar, obtener };
