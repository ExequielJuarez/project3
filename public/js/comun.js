/* ===== Utilidades compartidas por todas las pantallas ===== */
(function () {
  "use strict";

  const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const cantidadFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

  const App = {
    csrf: document.body.dataset.csrf,
    precio: (n) => moneda.format(Number(n) || 0),
    cantidad: (n) => cantidadFmt.format(Number(n) || 0),
    redondear: (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100,

    // "1.234,50" → 1234.5 · "12,5" → 12.5 · "12.5" → 12.5 · vacío → 0
    numero(valor) {
      let v = String(valor ?? "").trim();
      if (!v) return 0;
      if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    },

    // Para montos en pesos: "15.800" = quince mil ochocientos (el punto es de miles)
    dinero(valor) {
      const v = String(valor ?? "").trim();
      return /^\d{1,3}(\.\d{3})+$/.test(v) ? Number(v.replace(/\./g, "")) : App.numero(v);
    },

    esc(texto) {
      const d = document.createElement("div");
      d.textContent = texto ?? "";
      return d.innerHTML;
    },

    debounce(fn, ms) {
      let t;
      return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },

    async api(url, opciones = {}) {
      const cfg = { method: "GET", headers: { Accept: "application/json" }, ...opciones };
      if (cfg.body && typeof cfg.body !== "string") {
        cfg.headers["Content-Type"] = "application/json";
        cfg.body = JSON.stringify(cfg.body);
      }
      if (cfg.method !== "GET") cfg.headers["x-csrf-token"] = App.csrf;
      let r;
      try { r = await fetch(url, cfg); } catch { return { ok: false, status: 0, mensaje: "Sin conexión con el servidor" }; }
      let datos = {};
      try { datos = await r.json(); } catch { /* respuesta vacía */ }
      if (r.status === 401) { location.href = "/login"; }
      return { status: r.status, ...datos, ok: r.ok && datos.ok !== false };
    },

    toast(mensaje, tipo = "") {
      const t = document.createElement("div");
      t.className = "toast " + tipo;
      t.setAttribute("role", "status");
      t.textContent = mensaje;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    },

    // Pitido corto al leer un código (confirmación auditiva con la pistola)
    pitido(ok = true) {
      try {
        const ctx = (App._audio = App._audio || new (window.AudioContext || window.webkitAudioContext)());
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = ok ? 1100 : 300;
        g.gain.value = 0.04;
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + (ok ? 0.07 : 0.22));
      } catch { /* sin audio */ }
    },

    abrirModal(id) { const m = document.getElementById(id); m.hidden = false; return m; },
    cerrarModal(m) { m.hidden = true; },

    /*
     * Buscador de productos con soporte de pistola lectora.
     * - Enter: busca por código exacto (barras o interno); si no existe, busca por nombre.
     * - Al escribir letras muestra resultados en vivo (↑ ↓ Enter para elegir).
     * La pistola escribe el código y manda "Enter", por eso funciona como un teclado.
     */
    buscador({ input, panel, alElegir, alNoEncontrar }) {
      let items = [], sel = -1, pedido = 0;

      const ocultar = () => { panel.hidden = true; items = []; sel = -1; };
      const pintar = () => {
        panel.innerHTML = items.map((p, i) => `
          <button type="button" class="resultado ${i === sel ? "sel" : ""}" data-i="${i}">
            <span><strong>${App.esc(p.nombre)}</strong><small>${App.esc(p.codigo_barras || p.codigo_interno || "sin código")} · stock ${App.cantidad(p.stock)} ${App.esc(p.unidad)}</small></span>
            <span class="p">${App.precio(p.precio)}</span>
          </button>`).join("");
        panel.hidden = !items.length;
      };
      const elegir = (p) => { input.value = ""; ocultar(); alElegir(p); };

      async function buscarNombre(q) {
        const id = ++pedido;
        const r = await App.api("/api/productos/buscar?q=" + encodeURIComponent(q));
        if (id !== pedido) return null;       // llegó tarde, ya escribió otra cosa
        return r.ok ? r.productos : [];
      }

      const envivo = App.debounce(async () => {
        const q = input.value.trim();
        // Los códigos de solo números esperan al Enter (los envía la pistola)
        if (q.length < 2 || /^[\d*.,]+$/.test(q)) { if (!q) ocultar(); return; }
        const lista = await buscarNombre(q);
        if (lista) { items = lista; sel = lista.length ? 0 : -1; pintar(); }
      }, 220);

      input.addEventListener("input", envivo);
      input.addEventListener("keydown", async (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          if (!items.length) return;
          e.preventDefault();
          sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          pintar();
        } else if (e.key === "Escape") {
          input.value = ""; ocultar();
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (sel >= 0 && items[sel] && !panel.hidden) return elegir(items[sel]);
          const bruto = input.value.trim();
          if (!bruto) return;
          // Se vacía al instante: así el siguiente escaneo no se mezcla con este
          input.value = ""; ocultar();
          // "3*7791234" → 3 unidades de ese producto
          const m = bruto.match(/^(\d+(?:[.,]\d+)?)\*(.+)$/);
          const factor = m ? App.numero(m[1]) : 1;
          const codigo = m ? m[2].trim() : bruto;

          const r = await App.api("/api/productos/codigo/" + encodeURIComponent(codigo));
          if (r.ok) return elegir({ ...r.producto, _cantidad: factor });
          const lista = await buscarNombre(codigo);
          if (lista && lista.length === 1) return elegir({ ...lista[0], _cantidad: factor });
          if (lista && lista.length > 1) { if (!input.value) input.value = bruto; items = lista; sel = 0; pintar(); return; }
          App.pitido(false);
          alNoEncontrar && alNoEncontrar(codigo);
          if (!input.value) { input.value = bruto; input.select(); }
        }
      });
      panel.addEventListener("click", (e) => {
        const b = e.target.closest(".resultado");
        if (b) { input.value = ""; elegir(items[Number(b.dataset.i)]); }
      });
      document.addEventListener("click", (e) => { if (!panel.contains(e.target) && e.target !== input) ocultar(); });
      return { ocultar };
    },
  };
  window.App = App;

  /* ----- Menú lateral (tablet / celular) ----- */
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-menu-abrir]")) document.body.classList.add("menu-abierto");
    else if (e.target.closest("[data-menu-cerrar]")) document.body.classList.remove("menu-abierto");
    else if (e.target.closest("[data-imprimir]")) window.print();
    else if (e.target.closest("[data-cerrar-modal]")) App.cerrarModal(e.target.closest(".modal-fondo"));
  });

  /* ----- Confirmación antes de acciones delicadas ----- */
  document.addEventListener("submit", (e) => {
    const msg = e.target.dataset.confirmar;
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  /* ----- Mensajes que desaparecen solos ----- */
  document.querySelectorAll("[data-autocerrar]").forEach((el) => setTimeout(() => el.remove(), 6000));

  /* ----- Campos de código: la pistola manda Enter y no debe enviar el formulario ----- */
  document.querySelectorAll("[data-sin-enter]").forEach((el) =>
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); })
  );
})();
