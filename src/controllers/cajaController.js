const db = require("../config/db");
const cajaService = require("../services/cajaService");
const { dinero } = require("../helpers/dinero");

exports.estado = async (req, res) => {
  const caja = await cajaService.actual();
  if (!caja) return res.redirect("/caja/abrir");
  res.render("caja/estado", { titulo: "Caja", caja, r: await cajaService.resumen(caja.id), movimientos: await cajaService.movimientos(caja.id) });
};

exports.formAbrir = async (req, res) => {
  if (await cajaService.actual()) return res.redirect("/caja");
  // Sugerimos el efectivo contado al cierre anterior
  const ultima = await db.uno("SELECT monto_contado FROM cajas WHERE estado = 'cerrada' ORDER BY id DESC LIMIT 1");
  res.render("caja/abrir", { titulo: "Abrir caja", sugerido: ultima ? ultima.monto_contado : 0, error: null });
};

exports.abrir = async (req, res) => {
  const monto = dinero(req.body.monto_inicial);
  if (!(monto >= 0)) {
    return res.status(400).render("caja/abrir", { titulo: "Abrir caja", sugerido: 0, error: "Ingresá cuánto efectivo hay al empezar (puede ser 0)" });
  }
  try {
    await cajaService.abrir(req.session.usuario.id, monto);
    req.flash("ok", "Caja abierta. ¡Buen día de ventas!");
    res.redirect("/pos");
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/caja");
  }
};

exports.movimiento = async (req, res) => {
  const caja = await cajaService.actual();
  const monto = dinero(req.body.monto);
  const concepto = (req.body.concepto || "").trim();
  if (!caja || !["ingreso", "egreso"].includes(req.body.tipo) || !(monto > 0) || !concepto) {
    req.flash("error", "Completá tipo, concepto y un monto mayor a 0");
    return res.redirect("/caja");
  }
  await cajaService.movimiento(caja.id, req.session.usuario.id, req.body.tipo, concepto, monto);
  req.flash("ok", "Movimiento registrado");
  res.redirect("/caja");
};

exports.formCerrar = async (req, res) => {
  const caja = await cajaService.actual();
  if (!caja) return res.redirect("/caja/abrir");
  res.render("caja/cerrar", { titulo: "Cerrar caja", caja, r: await cajaService.resumen(caja.id), error: null });
};

exports.cerrar = async (req, res) => {
  const caja = await cajaService.actual();
  if (!caja) return res.redirect("/caja/abrir");
  const contado = dinero(req.body.monto_contado);
  if (!(contado >= 0)) {
    return res.status(400).render("caja/cerrar", { titulo: "Cerrar caja", caja, r: await cajaService.resumen(caja.id), error: "Ingresá el efectivo contado" });
  }
  await cajaService.cerrar(caja.id, req.session.usuario.id, contado, (req.body.notas || "").trim());
  req.flash("ok", "Caja cerrada. Se guardó el resumen del turno.");
  res.redirect(`/caja/${caja.id}`);
};

exports.historial = async (req, res) => {
  const cajas = await db.todos("SELECT c.*, u.nombre AS cajero FROM cajas c JOIN usuarios u ON u.id = c.usuario_apertura_id ORDER BY c.id DESC LIMIT 100");
  res.render("caja/historial", { titulo: "Historial de cajas", cajas });
};

exports.detalle = async (req, res) => {
  const caja = await db.uno(
    `SELECT c.*, u.nombre AS cajero, uc.nombre AS cerro FROM cajas c JOIN usuarios u ON u.id = c.usuario_apertura_id
     LEFT JOIN usuarios uc ON uc.id = c.usuario_cierre_id WHERE c.id = ?`, [req.params.id]);
  if (!caja) return res.status(404).render("error", { titulo: "No encontrada", mensaje: "Ese turno de caja no existe." });
  const ventas = await db.todos("SELECT * FROM ventas WHERE caja_id = ? ORDER BY id", [caja.id]);
  res.render("caja/detalle", { titulo: `Caja #${caja.id}`, caja, r: await cajaService.resumen(caja.id), movimientos: await cajaService.movimientos(caja.id), ventas });
};
