const db = require("../config/db");
const { redondear, numero } = require("../helpers/dinero");

// Ingreso de mercadería: suma stock y actualiza el costo (y opcionalmente el precio)
const crear = db.transaction(({ usuarioId, proveedorId, comprobante, notas, items }) => {
  if (!Array.isArray(items) || !items.length) throw new Error("La compra no tiene productos");
  let total = 0;
  const lineas = items.map((it) => {
    const cantidad = numero(it.cantidad), costo = numero(it.costo);
    if (!(cantidad > 0) || !(costo >= 0)) throw new Error("Cantidad o costo inválido");
    const p = db.prepare("SELECT id FROM productos WHERE id = ?").get(it.producto_id);
    if (!p) throw new Error("Producto inexistente");
    const sub = redondear(cantidad * costo);
    total += sub;
    return { id: p.id, cantidad, costo, sub, precio: it.precio !== undefined && it.precio !== "" ? numero(it.precio) : null };
  });
  total = redondear(total);
  const compra = db.prepare("INSERT INTO compras (proveedor_id, usuario_id, comprobante, total, notas) VALUES (?,?,?,?,?)")
    .run(proveedorId || null, usuarioId, comprobante || null, total, notas || null);
  const cid = compra.lastInsertRowid;
  const ref = `Compra #${cid}`;
  for (const l of lineas) {
    db.prepare("INSERT INTO compra_items (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES (?,?,?,?,?)").run(cid, l.id, l.cantidad, l.costo, l.sub);
    db.prepare("UPDATE productos SET stock = stock + ?, costo = ?, actualizado_en = datetime('now','localtime') WHERE id = ?").run(l.cantidad, redondear(l.costo), l.id);
    if (l.precio !== null && l.precio >= 0) db.prepare("UPDATE productos SET precio = ? WHERE id = ?").run(redondear(l.precio), l.id);
    const st = db.prepare("SELECT stock FROM productos WHERE id = ?").get(l.id).stock;
    db.prepare("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, referencia, usuario_id) VALUES (?, 'compra', ?, ?, ?, ?)")
      .run(l.id, l.cantidad, st, ref, usuarioId);
  }
  return cid;
});

const listar = () => db.prepare(`SELECT c.*, p.nombre AS proveedor, u.nombre AS usuario FROM compras c
  LEFT JOIN proveedores p ON p.id = c.proveedor_id JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.id DESC LIMIT 200`).all();

const obtener = (id) => {
  const c = db.prepare(`SELECT c.*, p.nombre AS proveedor, u.nombre AS usuario FROM compras c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ?`).get(id);
  if (c) c.items = db.prepare("SELECT i.*, p.nombre FROM compra_items i JOIN productos p ON p.id = i.producto_id WHERE compra_id = ?").all(id);
  return c;
};

module.exports = { crear, listar, obtener };
