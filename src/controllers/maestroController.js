// CRUD simple reutilizado por categorías, clientes y proveedores.
const db = require("../config/db");

module.exports = function crearMaestro({ tabla, titulo, singular, campos, ruta, soloActivos = true }) {
  const buscables = campos.filter((c) => c.buscar !== false);

  const filas = (q) => {
    const like = `%${q}%`;
    const activo = soloActivos ? "activo = 1 AND" : "";
    return db.todos(
      `SELECT * FROM ${tabla} WHERE ${activo} (${buscables.map((c) => `${c.nombre} LIKE ?`).join(" OR ") || "1"}) ORDER BY ${campos[0].nombre} LIMIT 500`,
      buscables.map(() => like));
  };
  const vista = async (res, extra = {}) =>
    res.render("maestros/lista", { titulo, singular, campos, ruta, filas: await filas(extra.q || ""), q: "", editando: null, error: null, ...extra });

  const leer = (body) => {
    const datos = {};
    for (const c of campos) datos[c.nombre] = (body[c.nombre] || "").trim() || null;
    const falta = campos.find((c) => c.requerido && !datos[c.nombre]);
    return { datos, error: falta ? `${falta.etiqueta} es obligatorio` : null };
  };
  const valores = (datos) => campos.map((c) => datos[c.nombre]);

  return {
    listar: async (req, res) => {
      const q = (req.query.q || "").trim();
      const editando = req.query.editar ? await db.uno(`SELECT * FROM ${tabla} WHERE id = ?`, [req.query.editar]) : null;
      await vista(res, { q, editando });
    },
    crear: async (req, res) => {
      const { datos, error } = leer(req.body);
      if (error) return vista(res.status(400), { error });
      try {
        await db.run(`INSERT INTO ${tabla} (${campos.map((c) => c.nombre)}) VALUES (${campos.map(() => "?")})`, valores(datos));
      } catch (e) {
        if (db.esDuplicado(e)) return vista(res.status(400), { error: `Ya existe ${singular} con ese nombre` });
        throw e;
      }
      req.flash("ok", `${singular[0].toUpperCase() + singular.slice(1)} guardado`);
      res.redirect(ruta);
    },
    actualizar: async (req, res) => {
      const { datos, error } = leer(req.body);
      if (error) { req.flash("error", error); return res.redirect(ruta); }
      try {
        await db.run(`UPDATE ${tabla} SET ${campos.map((c) => `${c.nombre} = ?`)} WHERE id = ?`, [...valores(datos), req.params.id]);
      } catch (e) {
        if (!db.esDuplicado(e)) throw e;
        req.flash("error", `Ya existe ${singular} con ese nombre`);
        return res.redirect(ruta);
      }
      req.flash("ok", "Cambios guardados");
      res.redirect(ruta);
    },
    eliminar: async (req, res) => {
      if (soloActivos) await db.run(`UPDATE ${tabla} SET activo = 0 WHERE id = ?`, [req.params.id]);
      else await db.run(`DELETE FROM ${tabla} WHERE id = ?`, [req.params.id]);
      req.flash("ok", "Eliminado");
      res.redirect(ruta);
    },
  };
};
