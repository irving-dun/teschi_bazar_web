// ===============================================
// === MANEJO DE LA SESIÓN EN EL MENÚ PRINCIPAL ===
// ===============================================

document.addEventListener("DOMContentLoaded", () => {
  const iniciaSesionBoton = document.getElementById("iniciaSesionButton");
  const contenedorPerfilUsuario = document.getElementById(
    "contenedorPerfilUsuario"
  );

  if (!iniciaSesionBoton || !contenedorPerfilUsuario) {
    console.error(
      "Error: los contenedores 'inicaSesion' o 'contenedorPerfilUsuario' no se encontraron en index.html"
    );
    return;
  }

  contenedorPerfilUsuario.style.display = "none";

  // === ESTADO DE LA SESIÓN ===
  firebase.auth().onAuthStateChanged((usuario) => {
    if (usuario) {
      iniciaSesionBoton.style.display = "none";

      // 2. Leemos los datos adicionales del usuario de Firestore
      db.collection("usuarios")
        .doc(usuario.uid)
        .get()
        .then((doc) => {
          const datosUsuarios = doc.exists ? doc.data() : {};
          const nombreUsuario =
            datosUsuarios.nombre || usuario.email.split("@")[0];

          // INICIO DE LA ESTRUCTURA DEL MENÚ DESPLEGABLE
          contenedorPerfilUsuario.innerHTML = `
              <div class="perfil-dropdown">
                  <button class="btn-UsuarioNombre" id="dropdownUserButton">
                      Hola, ${nombreUsuario}
                  </button>
                  <div class="dropdown-content" id="userDropdownContent">
                      <a href="perfil.html">✏️ Mi Perfil</a>
                      <a href="publicarProducto.html"> 🛍️ Publicar</a>
                      <a href="#" onclick="window.logoutFirebase()">🚪 Cerrar Sesión</a>
                      
                  </div>
              </div>
              `;
          contenedorPerfilUsuario.style.display = "block";

          // LÓGICA PARA MOSTRAR/OCULTAR EL MENÚ DESPLEGABLE
          const dropdownButton = document.getElementById("dropdownUserButton");
          const dropdownContent = document.getElementById(
            "userDropdownContent"
          );

          if (dropdownButton && dropdownContent) {
            dropdownButton.addEventListener("click", () => {
              dropdownContent.classList.toggle("show");
            });

            // Se cierra el menú si se hace click fuera
            window.addEventListener("click", (event) => {
              if (!event.target.matches("#dropdownUserButton")) {
                if (dropdownContent.classList.contains("show")) {
                  dropdownContent.classList.remove("show");
                }
              }
            });
          }
        })
        .catch((error) => {
          console.error("Error al obtener datos de FireStore: ", error);
          contenedorPerfilUsuario.innerHTML = `<button class="btn-UsuarioNombre" onclick ="window.logoutFirebase()"> Hola, ${
            usuario.email.split("@")[0]
          }</button>`;
          contenedorPerfilUsuario.style.display = "block";
        });
    } else {
      // SI NO HAY SESION
      iniciaSesionBoton.style.display = "block";
      contenedorPerfilUsuario.style.display = "none";
      contenedorPerfilUsuario.innerHTML = "";
    }
  });
});

// =FUNCIÓN PARA CERRAR SESIÓN =
window.logoutFirebase = function () {
  firebase
    .auth()
    .signOut()
    .then(() => {
      console.log("Sesion cerrada exitosamente");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Error al cerrar sesion", error);
      alert(
        "Hubo un problema al intentar cerrar la sesion. Intentalo mas tarde"
      );
    });
};
