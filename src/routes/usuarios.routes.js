const router = require("express").Router();
const c = require("../controllers/usuarioController");
const { requiereRol } = require("../middlewares/auth");

router.use(requiereRol("admin"));
router.get("/", c.listar);
router.post("/", c.crear);
router.post("/:id/estado", c.alternar);
router.post("/:id/clave", c.resetClave);

module.exports = router;
