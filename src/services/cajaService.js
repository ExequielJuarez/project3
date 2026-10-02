const db = require("../config/db");
const { redondear } = require("../helpers/dinero");

const actual = () =>
  db.uno("SELECT c.*, u.nombre AS cajero FROM cajas c JOIN usuarios u ON u.id = c.usuario_apertura_id WHERE c.estado = 'abierta'");

async function abrir(usuarioId, montoInicial) {
  if (await actual()) throw new Error("Ya hay una caja abierta");
  try {
    const r = await db.run("INSERT INTO cajas (fecha, usuario_apertura_id, monto_inicial) VALUES (CURDATE(), ?, ?)", [usuarioId, redondear(montoInicial)]);
    return r.insertId;
  } catch (e) {
    if (db.esDuplicado(e)) throw new Error("Ya hay una caja abierta"); // dos cajeros abriendo a la vez
    throw e;
  }
}

// Totales del turno calculados desde las ventas y movimientos
async function resumen(cajaId, ex = db) {
  const v = await ex.uno(
    `SELECT COUNT(*) AS cant, COALESCE(SUM(total),0) AS total, COALESCE(SUM(pago_efectivo),0) AS efectivo,
            COALESCE(SUM(pago_tarjeta),0) AS tarjeta, COALESCE(SUM(pago_transferencia),0) AS transferencia,
            COALESCE(SUM(descuento),0) AS descuentos
     FROM ventas WHERE caja_id = ? AND estado = 'completada'`, [cajaId]);
  const anuladas = await ex.uno("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS t FROM ventas WHERE caja_id = ? AND estado = 'anulada'", [cajaId]);
  const m = await ex.uno(
    `SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END),0) AS ingresos,
            COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END),0) AS egresos
     FROM caja_movimientos WHERE caja_id = ?`, [cajaId]);
  const caja = await ex.uno("SELECT monto_inicial FROM cajas WHERE id = ?", [cajaId]);
  const esperado = redondear(caja.monto_inicial + v.efectivo + m.ingresos - m.egresos);
  return {
    cantVentas: v.cant, totalVentas: redondear(v.total), efectivo: redondear(v.efectivo),
    tarjeta: redondear(v.tarjeta), transferencia: redondear(v.transferencia), descuentos: redondear(v.descuentos),
    anuladas: anuladas.n, totalAnuladas: redondear(anuladas.t),
    ingresos: redondear(m.ingresos), egresos: redondear(m.egresos),
    montoInicial: caja.monto_inicial, esperado,
  };
}

const cerrar = (cajaId, usuarioId, montoContado, notas) =>
  db.transaccion(async (t) => {
    const caja = await t.uno("SELECT * FROM cajas WHERE id = ? AND estado = 'abierta' FOR UPDATE", [cajaId]);
    if (!caja) throw new Error("La caja ya no está abierta");
    const r = await resumen(cajaId, t);
    const contado = redondear(montoContado);
    await t.run(
      `UPDATE cajas SET estado='cerrada', cerrada_en=NOW(), usuario_cierre_id=?,
         cant_ventas=?, total_ventas=?, total_efectivo=?, total_tarjeta=?, total_transferencia=?,
         ingresos_extra=?, egresos=?, monto_esperado=?, monto_contado=?, diferencia=?, notas_cierre=?
       WHERE id=?`,
      [usuarioId, r.cantVentas, r.totalVentas, r.efectivo, r.tarjeta, r.transferencia,
       r.ingresos, r.egresos, r.esperado, contado, redondear(contado - r.esperado), notas || null, cajaId]);
  });

const movimiento = (cajaId, usuarioId, tipo, concepto, monto) =>
  db.run("INSERT INTO caja_movimientos (caja_id, tipo, concepto, monto, usuario_id) VALUES (?,?,?,?,?)", [cajaId, tipo, concepto, redondear(monto), usuarioId]);

const movimientos = (cajaId) =>
  db.todos("SELECT m.*, u.nombre AS usuario FROM caja_movimientos m JOIN usuarios u ON u.id = m.usuario_id WHERE caja_id = ? ORDER BY m.id DESC", [cajaId]);

module.exports = { actual, abrir, resumen, cerrar, movimiento, movimientos };
