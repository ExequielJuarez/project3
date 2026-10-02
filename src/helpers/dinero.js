// El dinero se redondea a centavos para evitar errores de coma flotante.
const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const numero = (v) => {
  if (typeof v === "string") {
    v = v.trim();
    // "1.234,50" → 1234.50 · "12,5" → 12.5 · "12.5" → 12.5
    v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
// Para montos en pesos: "15.800" es quince mil ochocientos (punto = miles), no 15,8
const dinero = (v) => {
  if (typeof v === "string" && /^\s*\d{1,3}(\.\d{3})+\s*$/.test(v)) v = v.replace(/\./g, "");
  return numero(v);
};
module.exports = { redondear, numero, dinero };
