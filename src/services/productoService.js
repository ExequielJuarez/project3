const db = require("../config/db");
const { redondear, numero, dinero } = require("../helpers/dinero");

const BASE = `SELECT p.*, c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id`;

// Lo que lee la pistola: coincidencia exacta por código de barras o interno
const porCodigo = (codigo) =>
  db.prepare(`${BASE} WHERE p.activo = 1 AND (p.codigo_barras = ? OR p.codigo_interno = ?)`).get(codigo, codigo);

const buscar = (q, limite = 20) => {
  const like = `%${q}%`;
  return db.prepare(`${BASE} WHERE p.activo = 1 AND (p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.codigo_interno LIKE ?)
    ORDER BY p.nombre COLLATE NOCASE LIMIT ?`).all(like, like, like, limite);
};

const listar = ({ q, categoria, filtro }) => {
  const where = [];
  const params = [];
  if (q) { where.push("(p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.codigo_interno LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (categoria) { where.push("p.categoria_id = ?"); params.push(categoria); }
  if (filtro === "bajo") where.push("p.activo = 1 AND p.stock <= p.stock_minimo");
  if (filtro === "inactivos") where.push("p.activo = 0");
  else if (filtro !== "todos" && filtro !== "bajo") where.push("p.activo = 1");
  return db.prepare(`${BASE} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.nombre COLLATE NOCASE LIMIT 1000`).all(...params);
};

const obtener = (id) => db.prepare(`${BASE} WHERE p.id = ?`).get(id);

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
  if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return /codigo_barras/.test(e.message) ? "Ya existe un producto con ese código de barras" : "Ya existe un producto con ese código interno";
  }
  return null;
}

function crear(d, stockInicial, usuarioId) {
  return db.transaction(() => {
    const r = db.prepare(`INSERT INTO productos (codigo_barras, codigo_interno, nombre, categoria_id, costo, precio, stock, stock_minimo, unidad, activo)
      VALUES (@codigo_barras,@codigo_interno,@nombre,@categoria_id,@costo,@precio,@stock,@stock_minimo,@unidad,@activo)`)
      .run({ ...d, stock: stockInicial });
    if (stockInicial) {
      db.prepare("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, nota, usuario_id) VALUES (?, 'inicial', ?, ?, 'Stock inicial', ?)")
        .run(r.lastInsertRowid, stockInicial, stockInicial, usuarioId);
    }
    return r.lastInsertRowid;
  })();
}

const actualizar = (id, d) =>
  db.prepare(`UPDATE productos SET codigo_barras=@codigo_barras, codigo_interno=@codigo_interno, nombre=@nombre, categoria_id=@categoria_id,
    costo=@costo, precio=@precio, stock_minimo=@stock_minimo, unidad=@unidad, activo=@activo, actualizado_en=datetime('now','localtime') WHERE id=@id`)
    .run({ ...d, id });

// Ajuste manual: se informa el stock real contado y queda el registro de la diferencia
const ajustarStock = db.transaction((id, nuevoStock, nota, usuarioId) => {
  const p = db.prepare("SELECT stock FROM productos WHERE id = ?").get(id);
  if (!p) throw new Error("Producto inexistente");
  const dif = nuevoStock - p.stock;
  if (dif === 0) return;
  db.prepare("UPDATE productos SET stock = ?, actualizado_en = datetime('now','localtime') WHERE id = ?").run(nuevoStock, id);
  db.prepare("INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, nota, usuario_id) VALUES (?, 'ajuste', ?, ?, ?, ?)")
    .run(id, dif, nuevoStock, nota || "Ajuste manual", usuarioId);
});

const movimientos = (id) =>
  db.prepare("SELECT m.*, u.nombre AS usuario FROM stock_movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id WHERE producto_id = ? ORDER BY m.id DESC LIMIT 100").all(id);

const stockBajo = (limite = 10) =>
  db.prepare(`${BASE} WHERE p.activo = 1 AND p.stock <= p.stock_minimo ORDER BY (p.stock - p.stock_minimo) LIMIT ?`).all(limite);

module.exports = { porCodigo, buscar, listar, obtener, normalizar, mensajeUnico, crear, actualizar, ajustarStock, movimientos, stockBajo };
