const productoService = require("../services/productoService");
const ventaService = require("../services/ventaService");

const salida = (p, admin) => ({
  ...(admin ? { costo: p.costo } : {}),
  id: p.id, codigo_barras: p.codigo_barras, codigo_interno: p.codigo_interno, nombre: p.nombre,
  categoria: p.categoria, precio: p.precio, stock: p.stock, unidad: p.unidad, stock_minimo: p.stock_minimo,
});
const esAdmin = (req) => req.session.usuario.rol === "admin";

exports.porCodigo = async (req, res) => {
  const p = await productoService.porCodigo(String(req.params.codigo).trim());
  if (!p) return res.status(404).json({ ok: false, mensaje: "Producto no encontrado" });
  res.json({ ok: true, producto: salida(p, esAdmin(req)) });
};

exports.buscar = async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ ok: true, productos: [] });
  res.json({ ok: true, productos: (await productoService.buscar(q, 15)).map((p) => salida(p, esAdmin(req))) });
};

exports.crearVenta = async (req, res) => {
  try {
    const r = await ventaService.crear({
      usuarioId: req.session.usuario.id, cajaId: req.caja.id,
      items: req.body.items, descuento: req.body.descuento, pagos: req.body.pagos,
      clienteId: req.body.cliente_id ? Number(req.body.cliente_id) : null, notas: req.body.notas,
    });
    res.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof ventaService.ErrorVenta) return res.status(400).json({ ok: false, mensaje: e.message });
    throw e;
  }
};
