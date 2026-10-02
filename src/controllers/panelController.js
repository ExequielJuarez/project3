const db = require("../config/db");
const cajaService = require("../services/cajaService");
const productoService = require("../services/productoService");
const clienteSelect = () => db.prepare("SELECT id, nombre, documento FROM clientes WHERE activo = 1 ORDER BY nombre COLLATE NOCASE").all();

exports.inicio = (req, res) => {
  const caja = cajaService.actual();
  const deHoy = db.prepare("SELECT COUNT(*) cant, COALESCE(SUM(total),0) total FROM ventas WHERE estado='completada' AND fecha_dia = date('now','localtime')").get();
  const ultimas = db.prepare(`SELECT v.*, c.nombre AS cliente FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.fecha_dia = date('now','localtime') ORDER BY v.id DESC LIMIT 6`).all();
  res.render("panel", {
    titulo: "Inicio", caja, deHoy, ultimas,
    resumenCaja: caja ? cajaService.resumen(caja.id) : null,
    stockBajo: productoService.stockBajo(6),
    cantProductos: db.prepare("SELECT COUNT(*) n FROM productos WHERE activo = 1").get().n,
  });
};

exports.pos = (req, res) =>
  res.render("pos/pos", { titulo: "Punto de venta", clientes: clienteSelect(), bodyClase: "pagina-pos", estilo: "pos", script: "pos" });

exports.consultaPrecio = (req, res) => res.render("pos/precios", { titulo: "Consultar precio", bodyClase: "pagina-precios", estilo: "precios", script: "precios" });
