/* ===== Usuarios: pedir la nueva clave antes de enviar ===== */
document.querySelectorAll("form[data-pedir-clave]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    const clave = window.prompt("Nueva clave (mínimo 6 caracteres). El usuario deberá cambiarla al ingresar:");
    if (!clave) return e.preventDefault();
    form.querySelector("input[name=clave]").value = clave;
  });
});
