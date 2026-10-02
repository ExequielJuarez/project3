const bcrypt = require("bcryptjs");
const db = require("../config/db");

const lista = () => db.todos("SELECT * FROM usuarios ORDER BY activo DESC, nombre");

exports.listar = async (req, res) => res.render("usuarios/lista", { titulo: "Usuarios", usuarios: await lista(), error: null });

exports.crear = async (req, res) => {
  const { nombre = "", usuario = "", clave = "", rol } = req.body;
  const error = !nombre.trim() || !usuario.trim() ? "Nombre y usuario son obligatorios"
    : clave.length < 6 ? "La clave debe tener al menos 6 caracteres"
    : !["admin", "cajero"].includes(rol) ? "Rol inválido" : null;
  if (error) return res.status(400).render("usuarios/lista", { titulo: "Usuarios", usuarios: await lista(), error });
  try {
    await db.run("INSERT INTO usuarios (nombre, usuario, clave_hash, rol) VALUES (?,?,?,?)", [nombre.trim(), usuario.trim(), bcrypt.hashSync(clave, 10), rol]);
  } catch (e) {
    if (db.esDuplicado(e)) return res.status(400).render("usuarios/lista", { titulo: "Usuarios", usuarios: await lista(), error: "Ese nombre de usuario ya existe" });
    throw e;
  }
  req.flash("ok", "Usuario creado");
  res.redirect("/usuarios");
};

exports.alternar = async (req, res) => {
  if (Number(req.params.id) === req.session.usuario.id) { req.flash("error", "No podés desactivar tu propio usuario"); return res.redirect("/usuarios"); }
  await db.run("UPDATE usuarios SET activo = 1 - activo WHERE id = ?", [req.params.id]);
  req.flash("ok", "Usuario actualizado");
  res.redirect("/usuarios");
};

exports.resetClave = async (req, res) => {
  const clave = req.body.clave || "";
  if (clave.length < 6) { req.flash("error", "La clave debe tener al menos 6 caracteres"); return res.redirect("/usuarios"); }
  await db.run("UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 1 WHERE id = ?", [bcrypt.hashSync(clave, 10), req.params.id]);
  req.flash("ok", "Clave restablecida (deberá cambiarla al ingresar)");
  res.redirect("/usuarios");
};
