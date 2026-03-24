var volver = document.getElementById("volver"),
    cerrar = document.getElementById("cerrar");

cerrar.addEventListener("click", () => {
    window.location.href = "/borrarSesion";
})

volver.addEventListener("click", () => {
    window.history.back();
})