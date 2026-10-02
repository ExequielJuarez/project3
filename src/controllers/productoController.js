const db = require("../config/db");
const s = require("../services/productoService");
const { numero } = require("../helpers/dinero");

const categorias = () => db.todos("SELECT * FROM categorias ORDER BY nombre");

exports.listar = async (req, res) => {
  const { q = "", categoria = "", filtro = "" } = req.query;
  res.render("productos/lista", { titulo: "Productos", productos: await s.listar({ q, categoria, filtro }), categorias: await categorias(), q, categoria, filtro });
};

exports.nuevo = async (req, res) =>
  res.render("productos/form", { titulo: "Nuevo producto", p: { activo: 1, unidad: "u", stock: 0 }, categorias: await categorias(), error: null, esNuevo: true });

exports.crear = async (req, res) => {
  const { datos, error } = s.normalizar(req.body);
  const stock = numero(req.body.stock || 0);
  const volver = async (msg) =>
    res.status(400).render("productos/form", { titulo: "Nuevo producto", p: { ...req.body, activo: req.body.activo ? 1 : 0 }, categorias: await categorias(), error: msg, esNuevo: true });
  if (error) return volver(error);
  if (!(stock >= 0)) return volver("El stock inicial no es válido");
  try {
    await s.crear(datos, stock, req.session.usuario.id);
  } catch (e) {
    const m = s.mensajeUnico(e);
    if (m) return volver(m);
    throw e;
  }
  req.flash("ok", `Producto "${datos.nombre}" creado`);
  res.redirect(req.body.otro ? "/productos/nuevo" : "/productos");
};

exports.editar = async (req, res) => {
  const p = await s.obtener(req.params.id);
  if (!p) return res.status(404).render("error", { titulo: "No encontrado", mensaje: "Producto inexistente" });
  res.render("productos/form", { titulo: "Editar producto", p, categorias: await categorias(), error: null, esNuevo: false, movimientos: await s.movimientos(p.id) });
};

exports.actualizar = async (req, res) => {
  const p = await s.obtener(req.params.id);
  if (!p) return res.status(404).render("error", { titulo: "No encontrado", mensaje: "Producto inexistente" });
  const { datos, error } = s.normalizar(req.body);
  const volver = async (msg) =>
    res.status(400).render("productos/form", {
      titulo: "Editar producto", p: { ...p, ...req.body, id: p.id, stock: p.stock, activo: req.body.activo ? 1 : 0 },
      categorias: await categorias(), error: msg, esNuevo: false, movimientos: await s.movimientos(p.id),
    });
  if (error) return volver(error);
  try {
    await s.actualizar(p.id, datos);
  } catch (e) {
    const m = s.mensajeUnico(e);
    if (m) return volver(m);
    throw e;
  }
  req.flash("ok", "Producto actualizado");
  res.redirect("/productos");
};

exports.ajustar = async (req, res) => {
  const nuevo = numero(req.body.stock);
  if (!(nuevo >= 0)) { req.flash("error", "Stock inválido"); return res.redirect(`/productos/${req.params.id}/editar`); }
  await s.ajustarStock(req.params.id, nuevo, (req.body.nota || "").trim(), req.session.usuario.id);
  req.flash("ok", "Stock ajustado");
  res.redirect(`/productos/${req.params.id}/editar`);
};

exports.desactivar = async (req, res) => {
  await db.run("UPDATE productos SET activo = 0 WHERE id = ?", [req.params.id]);
  req.flash("ok", "Producto desactivado (el historial de ventas se conserva)");
  res.redirect("/productos");
};
