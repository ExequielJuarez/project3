const db = require("../config/db");
const { redondear } = require("../helpers/dinero");

const actual = () => db.prepare("SELECT c.*, u.nombre AS cajero FROM cajas c JOIN usuarios u ON u.id = c.usuario_apertura_id WHERE c.estado = 'abierta'").get();

function abrir(usuarioId, montoInicial) {
  if (actual()) throw new Error("Ya hay una caja abierta");
  const r = db.prepare("INSERT INTO cajas (usuario_apertura_id, monto_inicial) VALUES (?, ?)").run(usuarioId, redondear(montoInicial));
  return r.lastInsertRowid;
}

// Totales del turno calculados desde las ventas y movimientos
function resumen(cajaId) {
  const v = db.prepare(`
    SELECT COUNT(*) AS cant, COALESCE(SUM(total),0) AS total, COALESCE(SUM(pago_efectivo),0) AS efectivo,
           COALESCE(SUM(pago_tarjeta),0) AS tarjeta, COALESCE(SUM(pago_transferencia),0) AS transferencia,
           COALESCE(SUM(descuento),0) AS descuentos
    FROM ventas WHERE caja_id = ? AND estado = 'completada'`).get(cajaId);
  const anuladas = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM ventas WHERE caja_id = ? AND estado = 'anulada'").get(cajaId);
  const m = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END),0) AS ingresos,
           COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END),0) AS egresos
    FROM caja_movimientos WHERE caja_id = ?`).get(cajaId);
  const caja = db.prepare("SELECT monto_inicial FROM cajas WHERE id = ?").get(cajaId);
  const esperado = redondear(caja.monto_inicial + v.efectivo + m.ingresos - m.egresos);
  return {
    cantVentas: v.cant, totalVentas: redondear(v.total), efectivo: redondear(v.efectivo),
    tarjeta: redondear(v.tarjeta), transferencia: redondear(v.transferencia), descuentos: redondear(v.descuentos),
    anuladas: anuladas.n, totalAnuladas: redondear(anuladas.t),
    ingresos: redondear(m.ingresos), egresos: redondear(m.egresos),
    montoInicial: caja.monto_inicial, esperado,
  };
}

function cerrar(cajaId, usuarioId, montoContado, notas) {
  const caja = db.prepare("SELECT * FROM cajas WHERE id = ? AND estado = 'abierta'").get(cajaId);
  if (!caja) throw new Error("La caja ya no está abierta");
  const r = resumen(cajaId);
  const contado = redondear(montoContado);
  db.prepare(`
    UPDATE cajas SET estado='cerrada', cerrada_en=datetime('now','localtime'), usuario_cierre_id=?,
      cant_ventas=?, total_ventas=?, total_efectivo=?, total_tarjeta=?, total_transferencia=?,
      ingresos_extra=?, egresos=?, monto_esperado=?, monto_contado=?, diferencia=?, notas_cierre=?
    WHERE id=?`).run(
    usuarioId, r.cantVentas, r.totalVentas, r.efectivo, r.tarjeta, r.transferencia,
    r.ingresos, r.egresos, r.esperado, contado, redondear(contado - r.esperado), notas || null, cajaId
  );
}

function movimiento(cajaId, usuarioId, tipo, concepto, monto) {
  db.prepare("INSERT INTO caja_movimientos (caja_id, tipo, concepto, monto, usuario_id) VALUES (?,?,?,?,?)")
    .run(cajaId, tipo, concepto, redondear(monto), usuarioId);
}

const movimientos = (cajaId) =>
  db.prepare("SELECT m.*, u.nombre AS usuario FROM caja_movimientos m JOIN usuarios u ON u.id = m.usuario_id WHERE caja_id = ? ORDER BY m.id DESC").all(cajaId);

module.exports = { actual, abrir, resumen, cerrar, movimiento, movimientos };
