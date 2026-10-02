const db = require("../config/db");
const { redondear, numero, dinero } = require("../helpers/dinero");

const BASE = `SELECT p.*, c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id`;

// Lo que lee la pistola: coincidencia exacta por código de barras o interno
const porCodigo = (codigo) => db.uno(`${BASE} WHERE p.activo = 1 AND (p.codigo_barras = ? OR p.codigo_interno = ?)`, [codigo, codigo]);

const buscar = (q, limite = 20) => {
  const like = `%${q}%`;
  return db.todos(
    `${BASE} WHERE p.activo = 1 AND (p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.codigo_interno LIKE ?) ORDER BY p.nombre LIMIT ?`,
    [like, like, like, limite]);
};

const listar = ({ q, categoria, filtro }) => {
  const where = [];
  const params = [];
  if (q) { where.push("(p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.codigo_interno LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (categoria) { where.push("p.categoria_id = ?"); params.push(categoria); }
  if (filtro === "bajo") where.push("p.activo = 1 AND p.stock <= p.stock_minimo");
  if (filtro === "inactivos") where.push("p.activo = 0");
  else if (filtro !== "todos" && filtro !== "bajo") where.push("p.activo = 1");
  return db.todos(`${BASE} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.nombre LIMIT 1000`, params);
};

const obtener = (id) => db.uno(`${BASE} WHERE p.id = ?`, [id]);

// Valida y normaliza el formulario; devuelve { datos, error }
function normalizar(b) {
  const nombre = (b.nombre || "").trim();
  if (!nombre) return { error: "El nombre es obligatorio" };
  const precio = dinero(b.precio), costo = dinero(b.costo || 0), minimo = numero(b.stock_minimo || 0);
  if (!(precio >= 0)) return { error: "El precio de venta no es válido" };
  if (!(costo >= 0)) return { error: "El costo no es válido" };
  if (!(minimo >= 0)) return { error: "El stock mínimo no es válido" };
  return {
    datos: {
      codigo_barras: (b.codigo_barras || "").trim() || null,
      codigo_interno: (b.codigo_interno || "").trim() || null,
      nombre, categoria_id: b.categoria_id ? Number(b.categoria_id) : null,
      costo: redondear(costo), precio: redondear(precio), stock_minimo: minimo,
      unidad: (b.unidad || "u").trim() || "u", activo: b.activo ? 1 : 0,
    },
  };
}

function mensajeUnico(e) {
  if (!db.esDuplicado(e)) return null;
  return /codigo_barras/.test(e.message) ? "Ya existe un producto con ese código de barras" : "Ya existe un producto con ese código interno";
}

const crear = (d, stockInicial, usuarioId) =>
  db.transaccion(async (t) => {
    const r = await t.run(
      `INSERT INTO productos (codigo_barras, codigo_interno, nombre, categoria_id, costo, precio, stock, stock_minimo, unidad, activo)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [d.codigo_barras, d.codigo_interno, d.nombre, d.categoria_id, d.costo, d.precio, stockInicial, d.stock_minimo, d.unidad, d.activo]);
    if (stockInicial) {
      await t.run("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, nota, usuario_id) VALUES (?, 'inicial', ?, ?, 'Stock inicial', ?)",
        [r.insertId, stockInicial, stockInicial, usuarioId]);
    }
    return r.insertId;
  });

const actualizar = (id, d) =>
  db.run(
    `UPDATE productos SET codigo_barras=?, codigo_interno=?, nombre=?, categoria_id=?, costo=?, precio=?, stock_minimo=?, unidad=?, activo=? WHERE id=?`,
    [d.codigo_barras, d.codigo_interno, d.nombre, d.categoria_id, d.costo, d.precio, d.stock_minimo, d.unidad, d.activo, id]);

// Ajuste manual: se informa el stock real contado y queda el registro de la diferencia
const ajustarStock = (id, nuevoStock, nota, usuarioId) =>
  db.transaccion(async (t) => {
    const p = await t.uno("SELECT stock FROM productos WHERE id = ? FOR UPDATE", [id]);
    if (!p) throw new Error("Producto inexistente");
    const dif = redondear3(nuevoStock - p.stock);
    if (dif === 0) return;
    await t.run("UPDATE productos SET stock = ? WHERE id = ?", [nuevoStock, id]);
    await t.run("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, nota, usuario_id) VALUES (?, 'ajuste', ?, ?, ?, ?)",
      [id, dif, nuevoStock, nota || "Ajuste manual", usuarioId]);
  });
const redondear3 = (n) => Math.round(n * 1000) / 1000;

const movimientos = (id) =>
  db.todos("SELECT m.*, u.nombre AS usuario FROM stock_movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id WHERE producto_id = ? ORDER BY m.id DESC LIMIT 100", [id]);

const stockBajo = (limite = 10) =>
  db.todos(`${BASE} WHERE p.activo = 1 AND p.stock <= p.stock_minimo ORDER BY (p.stock - p.stock_minimo) LIMIT ?`, [limite]);

module.exports = { porCodigo, buscar, listar, obtener, normalizar, mensajeUnico, crear, actualizar, ajustarStock, movimientos, stockBajo };
