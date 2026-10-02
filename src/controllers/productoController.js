const db = require("../config/db");
const s = require("../services/productoService");
const { numero } = require("../helpers/dinero");

const categorias = () => db.prepare("SELECT * FROM categorias ORDER BY nombre COLLATE NOCASE").all();

exports.listar = (req, res) => {
  const { q = "", categoria = "", filtro = "" } = req.query;
  res.render("productos/lista", { titulo: "Productos", productos: s.listar({ q, categoria, filtro }), categorias: categorias(), q, categoria, filtro });
};

exports.nuevo = (req, res) =>
  res.render("productos/form", { titulo: "Nuevo producto", p: { activo: 1, unidad: "u", stock: 0 }, categorias: categorias(), error: null, esNuevo: true });

exports.crear = (req, res) => {
  const { datos, error } = s.normalizar(req.body);
  const stock = numero(req.body.stock || 0);
  const volver = (msg) => res.status(400).render("productos/form", { titulo: "Nuevo producto", p: { ...req.body, activo: req.body.activo ? 1 : 0 }, categorias: categorias(), error: msg, esNuevo: true });
  if (error) return volver(error);
  if (!(stock >= 0)) return volver("El stock inicial no es válido");
  try {
    s.crear(datos, stock, req.session.usuario.id);
  } catch (e) {
    const m = s.mensajeUnico(e);
    if (m) return volver(m);
    throw e;
  }
  req.flash("ok", `Producto "${datos.nombre}" creado`);
  res.redirect(req.body.otro ? "/productos/nuevo" : "/productos");
};

exports.editar = (req, res) => {
  const p = s.obtener(req.params.id);
  if (!p) return res.status(404).render("error", { titulo: "No encontrado", mensaje: "Producto inexistente" });
  res.render("productos/form", { titulo: "Editar producto", p, categorias: categorias(), error: null, esNuevo: false, movimientos: s.movimientos(p.id) });
};

exports.actualizar = (req, res) => {
  const p = s.obtener(req.params.id);
  if (!p) return res.status(404).render("error", { titulo: "No encontrado", mensaje: "Producto inexistente" });
  const { datos, error } = s.normalizar(req.body);
  const volver = (msg) => res.status(400).render("productos/form", { titulo: "Editar producto", p: { ...p, ...req.body, id: p.id, stock: p.stock, activo: req.body.activo ? 1 : 0 }, categorias: categorias(), error: msg, esNuevo: false, movimientos: s.movimientos(p.id) });
  if (error) return volver(error);
  try {
    s.actualizar(p.id, datos);
  } catch (e) {
    const m = s.mensajeUnico(e);
    if (m) return volver(m);
    throw e;
  }
  req.flash("ok", "Producto actualizado");
  res.redirect("/productos");
};

exports.ajustar = (req, res) => {
  const nuevo = numero(req.body.stock);
  if (!(nuevo >= 0)) { req.flash("error", "Stock inválido"); return res.redirect(`/productos/${req.params.id}/editar`); }
  s.ajustarStock(req.params.id, nuevo, (req.body.nota || "").trim(), req.session.usuario.id);
  req.flash("ok", "Stock ajustado");
  res.redirect(`/productos/${req.params.id}/editar`);
};

exports.desactivar = (req, res) => {
  db.prepare("UPDATE productos SET activo = 0 WHERE id = ?").run(req.params.id);
  req.flash("ok", "Producto desactivado (el historial de ventas se conserva)");
  res.redirect("/productos");
};
