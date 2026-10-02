const crear = require("../controllers/maestroController");
module.exports = require("./maestros")(
  crear({
    tabla: "categorias", titulo: "Categorías", singular: "una categoría", ruta: "/categorias", soloActivos: false,
    campos: [{ nombre: "nombre", etiqueta: "Nombre", requerido: true }],
  }),
  ["admin"]
);
