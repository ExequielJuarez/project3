const db = require("../config/db");
const compraService = require("../services/compraService");

const proveedores = () => db.prepare("SELECT id, nombre FROM proveedores WHERE activo = 1 ORDER BY nombre COLLATE NOCASE").all();

exports.listar = (req, res) => res.render("compras/lista", { titulo: "Compras", compras: compraService.listar() });
exports.nueva = (req, res) => res.render("compras/nueva", { titulo: "Ingreso de mercadería", proveedores: proveedores(), bodyClase: "pagina-compra", script: "compra" });

exports.crear = (req, res) => {
  try {
    const id = compraService.crear({
      usuarioId: req.session.usuario.id, proveedorId: req.body.proveedor_id ? Number(req.body.proveedor_id) : null,
      comprobante: req.body.comprobante, notas: req.body.notas, items: req.body.items,
    });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ ok: false, mensaje: e.message });
  }
};

exports.detalle = (req, res) => {
  const c = compraService.obtener(req.params.id);
  if (!c) return res.status(404).render("error", { titulo: "No encontrada", mensaje: "La compra no existe." });
  res.render("compras/detalle", { titulo: `Compra #${c.id}`, c });
};
