const bcrypt = require("bcryptjs");
const db = require("../config/db");

// Freno básico contra adivinar claves: 5 intentos fallidos → espera de 10 minutos
const intentos = new Map();
const MAX = 5, VENTANA = 10 * 60 * 1000;
const bloqueado = (k) => { const i = intentos.get(k); return i && i.n >= MAX && Date.now() - i.t < VENTANA; };
const fallo = (k) => { const i = intentos.get(k); intentos.set(k, { n: (i && Date.now() - i.t < VENTANA ? i.n : 0) + 1, t: Date.now() }); };

exports.formLogin = (req, res) => {
  if (req.session.usuario) return res.redirect("/");
  res.render("auth/login", { titulo: "Ingresar", error: null, layoutSimple: true });
};

exports.login = (req, res) => {
  const usuario = (req.body.usuario || "").trim();
  const clave = req.body.clave || "";
  const llave = `${req.ip}|${usuario.toLowerCase()}`;
  if (bloqueado(llave)) {
    return res.status(429).render("auth/login", { titulo: "Ingresar", error: "Demasiados intentos. Esperá unos minutos.", layoutSimple: true });
  }
  const u = db.prepare("SELECT * FROM usuarios WHERE usuario = ? AND activo = 1").get(usuario);
  if (!u || !bcrypt.compareSync(clave, u.clave_hash)) {
    fallo(llave);
    return res.status(401).render("auth/login", { titulo: "Ingresar", error: "Usuario o clave incorrectos", layoutSimple: true });
  }
  intentos.delete(llave);
  const volverA = req.session.volverA || "/";
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.usuario = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, debeCambiarClave: !!u.debe_cambiar_clave };
    res.redirect(u.debe_cambiar_clave ? "/perfil/clave" : volverA);
  });
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect("/login"));

exports.formClave = (req, res) => res.render("auth/clave", { titulo: "Cambiar clave", error: null });

exports.cambiarClave = (req, res) => {
  const { actual, nueva, repetir } = req.body;
  const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(req.session.usuario.id);
  const error =
    !bcrypt.compareSync(actual || "", u.clave_hash) ? "La clave actual no es correcta"
    : (nueva || "").length < 6 ? "La nueva clave debe tener al menos 6 caracteres"
    : nueva !== repetir ? "Las claves nuevas no coinciden"
    : nueva === actual ? "La nueva clave debe ser distinta de la actual" : null;
  if (error) return res.status(400).render("auth/clave", { titulo: "Cambiar clave", error });
  db.prepare("UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 0 WHERE id = ?").run(bcrypt.hashSync(nueva, 10), u.id);
  req.session.usuario.debeCambiarClave = false;
  req.flash("ok", "Clave actualizada");
  res.redirect("/");
};
