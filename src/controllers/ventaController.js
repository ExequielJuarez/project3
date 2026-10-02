const ventaService = require("../services/ventaService");
const { fechaLocal } = require("../helpers/formato");

exports.listar = (req, res) => {
  const hoy = fechaLocal();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || "") ? req.query.desde : hoy;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || "") ? req.query.hasta : desde;
  const q = (req.query.q || "").trim();
  const estado = ["completada", "anulada"].includes(req.query.estado) ? req.query.estado : "";
  const ventas = ventaService.listar({ desde, hasta, q, estado });
  const total = ventas.filter((v) => v.estado === "completada").reduce((a, v) => a + v.total, 0);
  res.render("ventas/lista", { titulo: "Ventas", ventas, desde, hasta, q, estado, total });
};

const buscar = (req, res) => {
  const v = ventaService.obtener(req.params.id);
  if (!v) res.status(404).render("error", { titulo: "No encontrada", mensaje: "La venta no existe." });
  return v;
};

exports.detalle = (req, res) => {
  const v = buscar(req, res);
  if (v) res.render("ventas/detalle", { titulo: `Venta ${v.numero}`, v });
};

// Comprobante imprimible (ticket de 80 mm o A4)
exports.imprimir = (req, res) => {
  const v = buscar(req, res);
  if (v) res.render("ventas/comprobante", { titulo: `Comprobante ${v.numero}`, v, layoutSimple: true, bodyClase: "pagina-comprobante", estilo: "comprobante", script: "comprobante" });
};

exports.anular = (req, res) => {
  const motivo = (req.body.motivo || "").trim();
  if (motivo.length < 3) { req.flash("error", "Indicá el motivo de la anulación"); return res.redirect(`/ventas/${req.params.id}`); }
  try {
    ventaService.anular(req.params.id, req.session.usuario.id, motivo);
    req.flash("ok", "Venta anulada. El stock fue devuelto.");
  } catch (e) {
    if (!(e instanceof ventaService.ErrorVenta)) throw e;
    req.flash("error", e.message);
  }
  res.redirect(`/ventas/${req.params.id}`);
};
