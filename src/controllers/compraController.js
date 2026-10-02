const db = require("../config/db");
const compraService = require("../services/compraService");

exports.listar = async (req, res) => res.render("compras/lista", { titulo: "Compras", compras: await compraService.listar() });

exports.nueva = async (req, res) => {
  const proveedores = await db.todos("SELECT id, nombre FROM proveedores WHERE activo = 1 ORDER BY nombre");
  res.render("compras/nueva", { titulo: "Ingreso de mercadería", proveedores, bodyClase: "pagina-compra", script: "compra" });
};

exports.crear = async (req, res) => {
  try {
    const id = await compraService.crear({
      usuarioId: req.session.usuario.id, proveedorId: req.body.proveedor_id ? Number(req.body.proveedor_id) : null,
      comprobante: req.body.comprobante, notas: req.body.notas, items: req.body.items,
    });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ ok: false, mensaje: e.message });
  }
};

exports.detalle = async (req, res) => {
  const c = await compraService.obtener(req.params.id);
  if (!c) return res.status(404).render("error", { titulo: "No encontrada", mensaje: "La compra no existe." });
  res.render("compras/detalle", { titulo: `Compra #${c.id}`, c });
};
