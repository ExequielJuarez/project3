const db = require("../config/db");

const todo = () => Object.fromEntries(db.prepare("SELECT clave, valor FROM configuracion").all().map((r) => [r.clave, r.valor]));
const guardar = (obj) => {
  const stmt = db.prepare("INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor");
  db.transaction(() => Object.entries(obj).forEach(([k, v]) => stmt.run(k, String(v ?? ""))))();
};
module.exports = { todo, guardar };
