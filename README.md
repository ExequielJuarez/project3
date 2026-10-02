# Sistema de gestión de negocio

Punto de venta + stock + caja + facturas para un comercio. Funciona con **pistola lectora de códigos de barras**, código manual o búsqueda por nombre, y se adapta a **PC, tablet y celular**.

**Stack:** Node.js · Express 5 · EJS · **MySQL** (mysql2) · CSS y JS propios (sin frameworks, siempre en archivos separados).

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completá DB_USER / DB_PASSWORD de tu MySQL y cambiá SESSION_SECRET
npm run db:demo             # crea la base, las tablas y productos de ejemplo (o: npm run db:instalar para vacía)
npm start                   # http://localhost:3000
```

Primer ingreso: usuario `admin` · clave `admin123` (el sistema obliga a cambiarla).
Para usarlo desde otro dispositivo del local (tablet/celular) entrá a `http://IP-DE-LA-PC:3000` en la misma red Wi‑Fi.

## Qué hace

| Módulo | Detalle |
|---|---|
| **Caja** | Al abrir pide el efectivo inicial. Permite ingresos/retiros de efectivo. Al cerrar compara lo esperado con lo contado y guarda la **foto del turno** (faltante/sobrante). Historial de todas las cajas. |
| **Punto de venta** | Pistola lectora (funciona como teclado: código + Enter), código manual, búsqueda por nombre, `3*codigo` para cantidades, pitido de confirmación, atajos `F4` cobrar / `Esc`. |
| **Consultar precio** | Pantalla aparte: pasás la pistola y muestra precio grande y stock, sin agregar nada a la venta. |
| **Cobro** | Efectivo, tarjeta, transferencia o **mixto**; calcula el vuelto. Descuento con tope configurable. |
| **Facturas** | Numeración correlativa `0001-00000001`. Comprobante imprimible en hoja A4 o ticket de 80 mm. Anulación (solo admin) que devuelve el stock. *Es un comprobante interno, no una factura fiscal AFIP.* |
| **Stock** | Se descuenta solo en cada venta, con kardex de todos los movimientos (venta, anulación, compra, ajuste). Alerta de stock bajo. Ajuste por inventario. |
| **Compras** | Ingreso de mercadería por proveedor: suma stock y actualiza costo/precio. |
| **Reportes** | Ventas por rango de fechas, registro diario, método de pago, horas pico, más vendidos, ganancia, valor del inventario, exportación a Excel (CSV). |
| **Usuarios** | Roles `admin` y `cajero` (el cajero no ve costos, reportes, compras ni configuración). |
| **Respaldo** | Botón en Configuración para descargar una copia de la base. |

## Base de datos (MySQL)

- Esquema SQL completo y comentado: [`database/schema.sql`](database/schema.sql). Tablas InnoDB, `utf8mb4`, dinero en `DECIMAL(12,2)`.
- Al iniciar (o con `npm run db:instalar`) el sistema **crea la base `negocio_db` y las tablas si faltan**; nunca borra datos. Solo necesitás un usuario de MySQL con permisos (configurado en `.env`).
- Cada venta, ítem, movimiento de stock, movimiento de caja y cierre queda registrado. La vista `v_resumen_diario` resume las ventas de cada día:
  ```sql
  SELECT * FROM v_resumen_diario ORDER BY fecha_dia DESC;
  ```
- Las ventas se guardan en una **transacción** con bloqueo de filas (`FOR UPDATE`): si algo falla no queda nada a medias y dos cajas no pueden vender el mismo último producto.
- Un índice único garantiza a nivel base que no existan dos cajas abiertas a la vez.
- Respaldo: Configuración → *Descargar respaldo* genera un `.sql` con todos los datos.
- Pruebas: `npm test` usa una base aparte (`negocio_db_test`) que recrea en cada corrida.

## Estructura

```
database/        schema.sql · datos-demo.sql · instalar.js
src/
  servidor.js    arranque de Express
  config/        conexión MySQL (db.js) e instalador de la base
  routes/        rutas por módulo
  controllers/   reciben la petición y arman la respuesta
  services/      lógica de negocio (ventas, caja, stock, compras, reportes)
  middlewares/   login/roles, CSRF
  views/         plantillas EJS (partials, pos, productos, ventas, caja…)
public/
  css/           base · componentes · layout · paginas · pos · precios · comprobante
  js/            comun · pos · precios · compra · cierre · producto · …
test/            pruebas de la lógica de negocio (npm test)
```

## Seguridad

Claves con bcrypt, sesiones con cookie `httpOnly`, protección CSRF, límite de intentos de login, permisos por rol, y los precios siempre se leen de la base (el navegador no puede alterarlos).

## Archivos heredados

`src/app.js`, `src/routes/index.Routes.js`, `.sequelizerc` y `src/model/` son del esqueleto anterior (Sequelize) y **no se usan**: el sistema arranca con `src/servidor.js` y consulta MySQL directamente con `mysql2`. Se pueden borrar junto con las dependencias `sequelize`, `multer`, `node-cron` y `express-validator`.
