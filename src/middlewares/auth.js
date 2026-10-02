const cajaService = require("../services/cajaService");

const esApi = (req) => req.originalUrl.startsWith("/api/");

function requiereLogin(req, res, next) {
  if (!req.session.usuario) {
    if (esApi(req)) return res.status(401).json({ ok: false, mensaje: "Tu sesión expiró, volvé a iniciar sesión" });
    req.session.volverA = req.originalUrl;
    return res.redirect("/login");
  }
  // Obliga a cambiar la clave inicial
  if (req.session.usuario.debeCambiarClave && !req.path.startsWith("/perfil") && req.path !== "/logout" && !esApi(req)) {
    return res.redirect("/perfil/clave");
  }
  next();
}

const requiereRol = (...roles) => (req, res, next) => {
  if (roles.includes(req.session.usuario.rol)) return next();
  if (esApi(req)) return res.status(403).json({ ok: false, mensaje: "No tenés permiso para esto" });
  res.status(403).render("error", { titulo: "Sin permiso", mensaje: "Tu usuario no tiene permiso para ver esta sección." });
};

function requiereCaja(req, res, next) {
  const caja = cajaService.actual();
  if (!caja) {
    if (esApi(req)) return res.status(409).json({ ok: false, mensaje: "La caja está cerrada. Abrila para vender." });
    req.flash("aviso", "Primero tenés que abrir la caja");
    return res.redirect("/caja/abrir");
  }
  req.caja = caja;
  next();
}

module.exports = { requiereLogin, requiereRol, requiereCaja };
