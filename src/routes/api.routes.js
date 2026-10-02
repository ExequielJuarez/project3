const router = require("express").Router();
const c = require("../controllers/apiController");
const { requiereCaja } = require("../middlewares/auth");

router.get("/productos/codigo/:codigo", c.porCodigo);
router.get("/productos/buscar", c.buscar);
router.post("/ventas", requiereCaja, c.crearVenta);

module.exports = router;
