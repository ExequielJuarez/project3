const crear = require("../controllers/maestroController");
module.exports = require("./maestros")(
  crear({
    tabla: "proveedores", titulo: "Proveedores", singular: "un proveedor", ruta: "/proveedores",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", requerido: true },
      { nombre: "contacto", etiqueta: "Contacto" },
      { nombre: "telefono", etiqueta: "Teléfono" },
      { nombre: "email", etiqueta: "Email", tipo: "email" },
    ],
  }),
  ["admin"]
);
