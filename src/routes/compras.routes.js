const router = require("express").Router();
const c = require("../controllers/compraController");
const { requiereRol } = require("../middlewares/auth");

router.use(requiereRol("admin"));
router.get("/", c.listar);
router.get("/nueva", c.nueva);
router.post("/", c.crear);
router.get("/:id", c.detalle);

module.exports = router;
