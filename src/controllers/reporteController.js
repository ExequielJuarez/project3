const db = require("../config/db");
const reportes = require("../services/reporteService");
const { fechaLocal } = require("../helpers/formato");

function rango(req) {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const hoy = new Date();
  const primero = fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const desde = ok(req.query.desde) ? req.query.desde : primero;
  const hasta = ok(req.query.hasta) ? req.query.hasta : fechaLocal(hoy);
  return { desde, hasta };
}

exports.ver = (req, res) => {
  const { desde, hasta } = rango(req);
  res.render("reportes/index", { titulo: "Reportes", desde, hasta, r: reportes.resumen(desde, hasta), inv: reportes.inventario() });
};

const csv = (v) => `"${String(typeof v === "number" ? String(v).replace(".", ",") : v ?? "").replace(/"/g, '""')}"`;

// Exporta las ventas del rango (abre directo en Excel)
exports.ventasCsv = (req, res) => {
  const { desde, hasta } = rango(req);
  const filas = db.prepare(`SELECT v.numero, v.fecha, v.estado, COALESCE(c.nombre,'Consumidor final') AS cliente, u.nombre AS cajero,
      v.subtotal, v.descuento, v.total, v.pago_efectivo, v.pago_tarjeta, v.pago_transferencia
    FROM ventas v JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.fecha_dia BETWEEN ? AND ? ORDER BY v.id`).all(desde, hasta);
  const cab = ["Factura", "Fecha", "Estado", "Cliente", "Cajero", "Subtotal", "Descuento", "Total", "Efectivo", "Tarjeta", "Transferencia"];
  const cuerpo = filas.map((f) => Object.values(f).map(csv).join(";"));
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ventas_${desde}_a_${hasta}.csv"` });
  res.send("﻿" + [cab.map(csv).join(";"), ...cuerpo].join("\r\n"));
};
