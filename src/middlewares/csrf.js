const crypto = require("crypto");

// Protección CSRF: cada sesión tiene un token que deben traer los POST
// (campo oculto "_csrf" en formularios o cabecera "x-csrf-token" en fetch).
module.exports = (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString("hex");
  res.locals.csrf = req.session.csrf;
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const token = req.body?._csrf || req.get("x-csrf-token");
  if (token && token === req.session.csrf) return next();
  if (req.originalUrl.startsWith("/api/")) return res.status(403).json({ ok: false, mensaje: "Sesión inválida, recargá la página" });
  res.status(403).render("error", { titulo: "Solicitud rechazada", mensaje: "El formulario venció. Volvé atrás, recargá la página e intentá de nuevo." });
};
