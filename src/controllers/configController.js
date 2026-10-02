const fs = require("fs");
const os = require("os");
const path = require("path");
const db = require("../config/db");
const configService = require("../services/configService");

exports.ver = (req, res) => res.render("config/index", { titulo: "Configuración", c: configService.todo() });

exports.guardar = (req, res) => {
  const b = req.body;
  const desc = Math.min(100, Math.max(0, Number(b.descuento_maximo) || 0));
  const pv = Math.max(1, parseInt(b.punto_venta, 10) || 1);
  configService.guardar({
    negocio_nombre: (b.negocio_nombre || "").trim() || "Mi Negocio",
    negocio_cuit: (b.negocio_cuit || "").trim(),
    negocio_direccion: (b.negocio_direccion || "").trim(),
    negocio_telefono: (b.negocio_telefono || "").trim(),
    pie_ticket: (b.pie_ticket || "").trim(),
    punto_venta: pv,
    descuento_maximo: desc,
    stock_negativo: b.stock_negativo ? "1" : "0",
  });
  req.flash("ok", "Configuración guardada");
  res.redirect("/configuracion");
};

// Copia consistente de la base (segura aunque haya ventas en curso)
exports.respaldo = async (req, res) => {
  const nombre = `respaldo_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.db`;
  const destino = path.join(os.tmpdir(), nombre);
  await db.backup(destino);
  res.download(destino, nombre, () => fs.unlink(destino, () => {}));
};
