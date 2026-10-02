/* ===== Ingreso de mercadería ===== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let items = []; // { id, nombre, cantidad, costo, precio }

  const total = () => App.redondear(items.reduce((a, i) => a + i.cantidad * i.costo, 0));

  function pintar() {
    $("vacio").hidden = items.length > 0;
    $("lineas").innerHTML = items.map((i, idx) => `
      <tr data-idx="${idx}">
        <td><strong>${App.esc(i.nombre)}</strong></td>
        <td class="derecha"><input type="text" inputmode="decimal" data-campo="cantidad" value="${i.cantidad}" style="width:90px;text-align:right"></td>
        <td class="derecha"><input type="text" inputmode="decimal" data-campo="costo" value="${i.costo}" style="width:110px;text-align:right"></td>
        <td class="derecha"><input type="text" inputmode="decimal" data-campo="precio" value="${i.precio}" style="width:110px;text-align:right"></td>
        <td class="derecha num negrita">${App.precio(i.cantidad * i.costo)}</td>
        <td><button type="button" class="btn-icono peligro" data-quitar aria-label="Quitar"><svg class="ico"><use href="#i-papelera"/></svg></button></td>
      </tr>`).join("");
    $("total").textContent = App.precio(total());
    $("btn-guardar").disabled = !items.length;
  }

  App.buscador({
    input: $("entrada"), panel: $("resultados"),
    alElegir: (p) => {
      const ex = items.find((i) => i.id === p.id);
      if (ex) ex.cantidad += p._cantidad || 1;
      else items.push({ id: p.id, nombre: p.nombre, cantidad: p._cantidad || 1, costo: p.costo ?? 0, precio: p.precio });
      App.pitido(true); pintar(); $("entrada").focus();
    },
    alNoEncontrar: (c) => App.toast(`No existe ningún producto con "${c}". Creálo primero en Productos.`, "error"),
  });

  $("lineas").addEventListener("change", (e) => {
    const campo = e.target.dataset.campo;
    if (!campo) return;
    const it = items[Number(e.target.closest("tr").dataset.idx)];
    const n = campo === "cantidad" ? App.numero(e.target.value) : App.dinero(e.target.value);
    if (Number.isNaN(n) || n < 0 || (campo === "cantidad" && n <= 0)) App.toast("Valor inválido", "error");
    else it[campo] = n;
    pintar();
  });
  $("lineas").addEventListener("click", (e) => {
    if (e.target.closest("[data-quitar]")) { items.splice(Number(e.target.closest("tr").dataset.idx), 1); pintar(); }
  });

  $("btn-guardar").addEventListener("click", async () => {
    $("btn-guardar").disabled = true;
    const r = await App.api("/compras", {
      method: "POST",
      body: {
        proveedor_id: $("proveedor").value || null, comprobante: $("comprobante").value.trim(), notas: $("notas").value.trim(),
        items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad, costo: i.costo, precio: i.precio })),
      },
    });
    if (!r.ok) { App.toast(r.mensaje || "No se pudo guardar", "error"); $("btn-guardar").disabled = false; return; }
    location.href = "/compras/" + r.id;
  });

  pintar();
})();
