const db = require("../config/db");

function resumen(desde, hasta) {
  const totales = db.prepare(`
    SELECT COUNT(*) AS cant, COALESCE(ROUND(SUM(total),2),0) AS total, COALESCE(ROUND(SUM(descuento),2),0) AS descuentos,
           COALESCE(ROUND(SUM(pago_efectivo),2),0) AS efectivo, COALESCE(ROUND(SUM(pago_tarjeta),2),0) AS tarjeta,
           COALESCE(ROUND(SUM(pago_transferencia),2),0) AS transferencia
    FROM ventas WHERE estado='completada' AND fecha_dia BETWEEN ? AND ?`).get(desde, hasta);
  const ganancia = db.prepare(`
    SELECT COALESCE(ROUND(SUM(i.subtotal - i.costo_unitario * i.cantidad),2),0) AS g
    FROM venta_items i JOIN ventas v ON v.id = i.venta_id WHERE v.estado='completada' AND v.fecha_dia BETWEEN ? AND ?`).get(desde, hasta).g;
  const porDia = db.prepare("SELECT * FROM v_resumen_diario WHERE fecha_dia BETWEEN ? AND ? ORDER BY fecha_dia DESC").all(desde, hasta);
  const top = db.prepare(`
    SELECT i.descripcion, ROUND(SUM(i.cantidad),3) AS cantidad, ROUND(SUM(i.subtotal),2) AS total
    FROM venta_items i JOIN ventas v ON v.id = i.venta_id WHERE v.estado='completada' AND v.fecha_dia BETWEEN ? AND ?
    GROUP BY COALESCE(i.producto_id, i.descripcion), i.descripcion ORDER BY total DESC LIMIT 10`).all(desde, hasta);
  const porHora = db.prepare(`
    SELECT substr(fecha, 12, 2) AS hora, COUNT(*) AS cant, ROUND(SUM(total),2) AS total
    FROM ventas WHERE estado='completada' AND fecha_dia BETWEEN ? AND ? GROUP BY hora ORDER BY hora`).all(desde, hasta);
  return { totales, ganancia, porDia, top, porHora, ticketPromedio: totales.cant ? totales.total / totales.cant : 0 };
}

const inventario = () => db.prepare(`
  SELECT COUNT(*) AS productos, COALESCE(ROUND(SUM(stock*costo),2),0) AS valor_costo, COALESCE(ROUND(SUM(stock*precio),2),0) AS valor_venta,
         SUM(CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END) AS bajos
  FROM productos WHERE activo = 1`).get();

module.exports = { resumen, inventario };
