/* ===== Punto de venta ===== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const raiz = $("pos");
  const permitirNegativo = raiz.dataset.stockNegativo === "1";
  const descuentoMax = Number(raiz.dataset.descuentoMax || 100);

  const entrada = $("entrada"), lineasEl = $("lineas"), btnCobrar = $("btn-cobrar");
  const descuentoEl = $("descuento");
  let items = [];        // { id, nombre, codigo, precio, cantidad, stock, unidad }
  let enviando = false;

  /* ---------- Carrito ---------- */
  const subtotal = () => App.redondear(items.reduce((a, i) => a + i.precio * i.cantidad, 0));
  const descuento = () => {
    const d = Math.max(0, App.dinero(descuentoEl.value) || 0);
    return App.redondear(Math.min(d, subtotal() * descuentoMax / 100));
  };
  const total = () => App.redondear(subtotal() - descuento());

  function agregar(p, cantidad = p._cantidad || 1) {
    const existente = items.find((i) => i.id === p.id);
    const nuevaCant = (existente ? existente.cantidad : 0) + cantidad;
    if (!permitirNegativo && nuevaCant > p.stock) {
      App.pitido(false);
      App.toast(`Stock insuficiente de ${p.nombre} (hay ${App.cantidad(p.stock)})`, "error");
      entrada.focus();
      return;
    }
    if (existente) existente.cantidad = nuevaCant;
    else items.unshift({ id: p.id, nombre: p.nombre, codigo: p.codigo_barras || p.codigo_interno || "", precio: p.precio, cantidad, stock: p.stock, unidad: p.unidad });
    App.pitido(true);
    pintar(p.id);
    entrada.focus();
  }

  function pintar(resaltarId) {
    if (!items.length) {
      lineasEl.innerHTML = '<div class="pos-vacio"><svg class="ico"><use href="#i-precio"/></svg><p>Escaneá un producto para empezar</p></div>';
    } else {
      lineasEl.innerHTML = items.map((i, idx) => `
        <div class="linea ${i.id === resaltarId ? "nueva" : ""}" data-idx="${idx}">
          <div class="linea-nombre"><strong>${App.esc(i.nombre)}</strong><small>${App.precio(i.precio)} c/${App.esc(i.unidad)}${i.codigo ? " · " + App.esc(i.codigo) : ""}</small></div>
          <div class="cantidad">
            <button type="button" data-accion="menos" aria-label="Restar uno">−</button>
            <input type="text" inputmode="decimal" value="${App.cantidad(i.cantidad).replace(/\./g, "")}" data-accion="cantidad" aria-label="Cantidad">
            <button type="button" data-accion="mas" aria-label="Sumar uno">+</button>
          </div>
          <div class="linea-sub num">${App.precio(i.precio * i.cantidad)}</div>
          <button type="button" class="btn-icono peligro" data-accion="quitar" aria-label="Quitar"><svg class="ico"><use href="#i-papelera"/></svg></button>
        </div>`).join("");
    }
    totales();
  }

  function totales() {
    $("subtotal").textContent = App.precio(subtotal());
    $("total").textContent = App.precio(total());
    $("cant-items").textContent = items.reduce((a, i) => a + i.cantidad, 0).toString().replace(/(\.\d{3})\d+/, "$1");
    btnCobrar.disabled = !items.length || total() < 0;
  }

  lineasEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.tagName === "INPUT") return;
    const idx = Number(b.closest(".linea").dataset.idx), it = items[idx];
    if (b.dataset.accion === "quitar") items.splice(idx, 1);
    if (b.dataset.accion === "mas") {
      if (!permitirNegativo && it.cantidad + 1 > it.stock) { App.toast("No hay más stock de este producto", "error"); return; }
      it.cantidad += 1;
    }
    if (b.dataset.accion === "menos") { it.cantidad -= 1; if (it.cantidad <= 0) items.splice(idx, 1); }
    pintar();
  });
  lineasEl.addEventListener("change", (e) => {
    if (e.target.dataset.accion !== "cantidad") return;
    const it = items[Number(e.target.closest(".linea").dataset.idx)];
    const n = App.numero(e.target.value);
    if (!(n > 0)) { items.splice(items.indexOf(it), 1); }
    else if (!permitirNegativo && n > it.stock) { App.toast(`Stock disponible: ${App.cantidad(it.stock)}`, "error"); }
    else it.cantidad = n;
    pintar();
  });
  lineasEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); e.target.blur(); entrada.focus(); } });

  descuentoEl.addEventListener("input", totales);
  descuentoEl.addEventListener("focus", () => descuentoEl.select());

  function limpiar() {
    items = []; descuentoEl.value = "0"; $("cliente").value = ""; $("notas").value = "";
    pintar(); entrada.focus();
  }
  $("btn-vaciar").addEventListener("click", () => { if (items.length && confirm("¿Vaciar la venta actual?")) limpiar(); });
  $("btn-cancelar").addEventListener("click", () => { if (!items.length || confirm("¿Cancelar la venta actual?")) limpiar(); });
  $("btn-agregar").addEventListener("click", () => entrada.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));

  /* ---------- Buscador / pistola ---------- */
  App.buscador({
    input: entrada, panel: $("resultados"),
    alElegir: (p) => agregar(p),
    alNoEncontrar: (cod) => App.toast(`No existe ningún producto con "${cod}"`, "error"),
  });

  /* ---------- Cobro ---------- */
  const campos = { efectivo: $("pago-efectivo"), tarjeta: $("pago-tarjeta"), transferencia: $("pago-transferencia") };
  const modalCobro = $("modal-cobro");

  function pagos() {
    return {
      efectivo: Math.max(0, App.dinero(campos.efectivo.value) || 0),
      tarjeta: Math.max(0, App.dinero(campos.tarjeta.value) || 0),
      transferencia: Math.max(0, App.dinero(campos.transferencia.value) || 0),
    };
  }

  function evaluarCobro() {
    const t = total(), p = pagos();
    const recibido = App.redondear(p.efectivo + p.tarjeta + p.transferencia);
    const dif = App.redondear(recibido - t);
    const estado = $("cobro-estado");
    let valido = false;
    if (dif < 0) {
      estado.innerHTML = `<div class="falta-grande">Falta cobrar ${App.precio(-dif)}</div>`;
    } else if (dif > p.efectivo) {
      estado.innerHTML = `<div class="falta-grande">El vuelto (${App.precio(dif)}) supera el efectivo recibido</div>`;
    } else {
      valido = true;
      estado.innerHTML = dif > 0 ? `<div class="vuelto-grande">Vuelto: ${App.precio(dif)}</div>` : `<div class="vuelto-grande">Pago exacto ✔</div>`;
    }
    $("btn-confirmar").disabled = !valido || enviando;
    return { valido, vuelto: dif > 0 ? dif : 0 };
  }

  function abrirCobro() {
    if (!items.length) return;
    $("cobro-total").textContent = App.precio(total());
    campos.tarjeta.value = ""; campos.transferencia.value = "";
    campos.efectivo.value = String(total()).replace(".", ",");
    App.abrirModal("modal-cobro");
    evaluarCobro();
    campos.efectivo.focus(); campos.efectivo.select();
  }
  btnCobrar.addEventListener("click", abrirCobro);

  Object.values(campos).forEach((c) => {
    c.addEventListener("input", evaluarCobro);
    c.addEventListener("focus", () => c.select());
    c.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!$("btn-confirmar").disabled) confirmar(); } });
  });
  modalCobro.addEventListener("click", (e) => {
    const b = e.target.closest("[data-completar]");
    if (!b) return;
    Object.values(campos).forEach((c) => (c.value = ""));
    campos[b.dataset.completar].value = String(total()).replace(".", ",");
    evaluarCobro();
  });

  async function confirmar() {
    if (enviando) return;
    const { valido, vuelto } = evaluarCobro();
    if (!valido) return;
    enviando = true; $("btn-confirmar").disabled = true; $("btn-confirmar").textContent = "Registrando…";
    const r = await App.api("/api/ventas", {
      method: "POST",
      body: {
        items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
        descuento: descuento(), pagos: pagos(),
        cliente_id: $("cliente").value || null, notas: $("notas").value.trim(),
      },
    });
    enviando = false; $("btn-confirmar").textContent = "Confirmar venta";
    if (!r.ok) {
      App.pitido(false);
      App.toast(r.mensaje || "No se pudo registrar la venta", "error");
      evaluarCobro();
      if (r.status === 409) location.href = "/caja/abrir";
      return;
    }
    App.cerrarModal(modalCobro);
    $("exito-numero").textContent = "Factura " + r.numero + " · " + App.precio(r.total);
    $("exito-vuelto-caja").hidden = !(vuelto > 0);
    $("exito-vuelto").textContent = App.precio(vuelto);
    $("exito-imprimir").href = "/ventas/" + r.id + "/imprimir";
    App.abrirModal("modal-exito");
    $("exito-nueva").focus();
  }
  $("btn-confirmar").addEventListener("click", confirmar);
  $("exito-nueva").addEventListener("click", () => { App.cerrarModal($("modal-exito")); limpiar(); });

  /* ---------- Atajos de teclado ---------- */
  const hayModal = () => !!document.querySelector(".modal-fondo:not([hidden])");
  document.addEventListener("keydown", (e) => {
    if (e.key === "F4") { e.preventDefault(); if (!hayModal()) abrirCobro(); return; }
    if (e.key === "Escape") {
      if (!$("modal-exito").hidden) { $("exito-nueva").click(); return; }
      if (!modalCobro.hidden) { App.cerrarModal(modalCobro); entrada.focus(); }
      return;
    }
    // Si empieza a llegar un código y el foco está en otro lado, lo llevamos al buscador
    const t = e.target;
    const enCampo = /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    if (!enCampo && !hayModal() && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) entrada.focus();
  });
  window.addEventListener("beforeunload", (e) => { if (items.length) { e.preventDefault(); e.returnValue = ""; } });

  pintar();
  entrada.focus();
})();
