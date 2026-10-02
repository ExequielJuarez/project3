const router = require("express").Router();
const c = require("../controllers/authController");
const { requiereLogin } = require("../middlewares/auth");

router.get("/login", c.formLogin);
router.post("/login", c.login);
router.post("/logout", c.logout);
router.get("/perfil/clave", requiereLogin, c.formClave);
router.post("/perfil/clave", requiereLogin, c.cambiarClave);

module.exports = router;
