const db = require("../config/db");
const cajaService = require("../services/cajaService");
const productoService = require("../services/productoService");

exports.inicio = async (req, res) => {
  const caja = await cajaService.actual();
  const deHoy = await db.uno("SELECT COUNT(*) AS cant, COALESCE(SUM(total),0) AS total FROM ventas WHERE estado='completada' AND fecha_dia = CURDATE()");
  const ultimas = await db.todos(`SELECT v.*, c.nombre AS cliente FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.fecha_dia = CURDATE() ORDER BY v.id DESC LIMIT 6`);
  res.render("panel", {
    titulo: "Inicio", caja, deHoy, ultimas,
    resumenCaja: caja ? await cajaService.resumen(caja.id) : null,
    stockBajo: await productoService.stockBajo(6),
    cantProductos: (await db.uno("SELECT COUNT(*) AS n FROM productos WHERE activo = 1")).n,
  });
};

exports.pos = async (req, res) => {
  const clientes = await db.todos("SELECT id, nombre, documento FROM clientes WHERE activo = 1 ORDER BY nombre");
  res.render("pos/pos", { titulo: "Punto de venta", clientes, bodyClase: "pagina-pos", estilo: "pos", script: "pos" });
};

exports.consultaPrecio = (req, res) =>
  res.render("pos/precios", { titulo: "Consultar precio", bodyClase: "pagina-precios", estilo: "precios", script: "precios" });
