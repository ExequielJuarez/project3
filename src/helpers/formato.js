// Funciones de formato disponibles en todas las vistas (app.locals)
const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const cantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

const fechaLocal = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

module.exports = {
  precio: (n) => moneda.format(Number(n) || 0),
  cant: (n) => cantidad.format(Number(n) || 0),
  // "2026-10-02 14:35:10" → "02/10/2026 14:35"
  fechaHora: (s) => {
    if (!s) return "—";
    const [f, h = ""] = String(s).split(" ");
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}${h ? " " + h.slice(0, 5) : ""}`;
  },
  fecha: (s) => {
    if (!s) return "—";
    const [a, m, d] = String(s).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  },
  hoy: () => fechaLocal(),
  fechaLocal,
};
