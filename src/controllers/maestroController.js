// CRUD simple reutilizado por categorías, clientes y proveedores.
const db = require("../config/db");

module.exports = function crearMaestro({ tabla, titulo, singular, campos, ruta, soloAdmin = false, soloActivos = true }) {
  const filas = (q) => {
    const like = `%${q}%`;
    const buscables = campos.filter((c) => c.buscar !== false).map((c) => `${c.nombre} LIKE ?`).join(" OR ");
    const activo = soloActivos ? "activo = 1 AND" : "";
    return db.prepare(`SELECT * FROM ${tabla} WHERE ${activo} (${buscables || "1"}) ORDER BY ${campos[0].nombre} COLLATE NOCASE LIMIT 500`)
      .all(...campos.filter((c) => c.buscar !== false).map(() => like));
  };
  const vista = (res, extra = {}) =>
    res.render("maestros/lista", { titulo, singular, campos, ruta, filas: filas(extra.q || ""), q: "", editando: null, error: null, ...extra });

  const leer = (body) => {
    const datos = {};
    for (const c of campos) datos[c.nombre] = (body[c.nombre] || "").trim() || null;
    const falta = campos.find((c) => c.requerido && !datos[c.nombre]);
    return { datos, error: falta ? `${falta.etiqueta} es obligatorio` : null };
  };

  return {
    listar: (req, res) => {
      const q = (req.query.q || "").trim();
      const editando = req.query.editar ? db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(req.query.editar) : null;
      vista(res, { q, editando });
    },
    crear: (req, res) => {
      const { datos, error } = leer(req.body);
      if (error) return vista(res.status(400), { error });
      try {
        db.prepare(`INSERT INTO ${tabla} (${campos.map((c) => c.nombre)}) VALUES (${campos.map((c) => "@" + c.nombre)})`).run(datos);
      } catch (e) {
        if (e.code === "SQLITE_CONSTRAINT_UNIQUE") return vista(res.status(400), { error: `Ya existe ${singular} con ese nombre` });
        throw e;
      }
      req.flash("ok", `${singular[0].toUpperCase() + singular.slice(1)} guardado`);
      res.redirect(ruta);
    },
    actualizar: (req, res) => {
      const { datos, error } = leer(req.body);
      if (error) { req.flash("error", error); return res.redirect(ruta); }
      try {
        db.prepare(`UPDATE ${tabla} SET ${campos.map((c) => `${c.nombre} = @${c.nombre}`)} WHERE id = @id`).run({ ...datos, id: req.params.id });
      } catch (e) {
        if (e.code !== "SQLITE_CONSTRAINT_UNIQUE") throw e;
        req.flash("error", `Ya existe ${singular} con ese nombre`);
        return res.redirect(ruta);
      }
      req.flash("ok", "Cambios guardados");
      res.redirect(ruta);
    },
    eliminar: (req, res) => {
      if (soloActivos) db.prepare(`UPDATE ${tabla} SET activo = 0 WHERE id = ?`).run(req.params.id);
      else db.prepare(`DELETE FROM ${tabla} WHERE id = ?`).run(req.params.id);
      req.flash("ok", "Eliminado");
      res.redirect(ruta);
    },
    soloAdmin,
  };
};
