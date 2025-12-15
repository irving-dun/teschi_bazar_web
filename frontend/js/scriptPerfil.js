// =========================================================
// === LÓGICA DE CARGA Y EDICIÓN DE PERFIL (AUTH + FIRESTORE) ===
// =========================================================

// Usamos document.addEventListener("DOMContentLoaded") para asegurar que el código
// JavaScript se ejecute solo cuando todos los elementos del HTML (perfil.html) hayan cargado.
document.addEventListener("DOMContentLoaded", () => {
  // Obtenemos las referencias a los elementos del formulario mediante sus IDs.
  const perfilForm = document.getElementById("perfilForm");
  const nombreInput = document.getElementById("nombre");
  const emailInput = document.getElementById("email");
  const telefonoInput = document.getElementById("telefono");
  const passwordInput = document.getElementById("password");
  const mensajeError = document.getElementById("mensajeError");
  const mensajeExito = document.getElementById("mensajeExito");

  // Variables para guardar el ID único del usuario (UID) y su objeto actual de sesión.
  let userUID = null;
  let currentUser = null;

  // Función para obtener datos adicionales (Nombre, Teléfono) desde Firestore
  function cargarDatosUsuario(uid) {
    db.collection("usuarios")
      .doc(uid) // Buscamos el documento que coincide con el ID del usuario (UID)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const datos = doc.data();
          // Rellenamos los campos del formulario con los datos de Firestore
          nombreInput.value = datos.nombre || "";
          telefonoInput.value = datos.telefono || "";
        } else {
          console.warn("Mi documento de usuario no está en Firestore.");
        }
      })
      .catch((error) => {
        console.error("Error al obtener datos de Firestore:", error);
        mensajeError.textContent =
          "Error al cargar datos del perfil. Inténtalo más tarde.";
        mensajeError.style.display = "block";
      });
  }

  // firebase.auth().onAuthStateChanged() es un observador que se ejecuta
  // cada vez que el estado de inicio de sesión del usuario cambia.
  firebase.auth().onAuthStateChanged((usuario) => {
    if (usuario) {
      // Si el objeto 'usuario' existe, significa que hay una sesión activa.
      currentUser = usuario;
      userUID = usuario.uid;
      emailInput.value = usuario.email; // El email lo obtenemos directamente del objeto Auth
      cargarDatosUsuario(userUID); // Y llamamos a la función para cargar datos de Firestore
    } else {
      // Si no hay objeto 'usuario' (es decir, null), el usuario no está logeado.
      alert("Debes iniciar sesión para ver tu perfil.");
      window.location.href = "index.html"; // Redirigimos al inicio
    }
  });

  // perfilForm.addEventListener("submit") escucha cuando el usuario hace clic
  // en el botón "Guardar Cambios" y evita que el formulario se envíe de forma predeterminada.
  perfilForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. LIMPIAR Y OCULTAR MENSAJES ANTERIORES para el nuevo intento de guardado
    mensajeError.textContent = "";
    mensajeExito.textContent = "";
    mensajeError.style.display = "none";
    mensajeExito.style.display = "none";

    // Verificamos que todavía tengamos una sesión válida
    if (!currentUser) {
      mensajeError.textContent = "Error: Sesión de usuario no válida.";
      mensajeError.style.display = "block";
      return;
    }

    // Obtenemos los valores ingresados en los campos del formulario
    const nuevoEmail = emailInput.value;
    const nuevaPassword = passwordInput.value;
    const nombre = nombreInput.value;
    const telefono = telefonoInput.value;

    // Array que guardará las promesas de actualización (son operaciones asíncronas)
    const updatePromises = [];

    // 1. ACTUALIZACIÓN DE EMAIL (solo si el email ha sido modificado)
    if (nuevoEmail !== currentUser.email) {
      // Agregamos la promesa de actualizar el email de Firebase Auth
      updatePromises.push(currentUser.updateEmail(nuevoEmail));
    }

    // 2. ACTUALIZACIÓN DE CONTRASEÑA (solo si se ingresó una nueva y es válida)
    if (nuevaPassword && nuevaPassword.length >= 6) {
      // Agregamos la promesa de actualizar la contraseña de Firebase Auth
      updatePromises.push(currentUser.updatePassword(nuevaPassword));
    } else if (nuevaPassword && nuevaPassword.length < 6) {
      // Si la contraseña es corta, mostramos error y salimos de la función
      mensajeError.textContent =
        " La contraseña debe tener al menos 6 caracteres.";
      mensajeError.style.display = "block";
      return;
    }

    // 3. ACTUALIZACIÓN DE FIRESTORE (Nombre y Teléfono)
    const datosFirestore = { nombre, telefono };

    // Agregamos la promesa para actualizar el documento de Firestore
    updatePromises.push(
      db.collection("usuarios").doc(userUID).update(datosFirestore)
    );

    // EJECUTAMOS TODAS LAS ACTUALIZACIONES
    // Promise.all() espera a que todas las promesas en el array 'updatePromises' se resuelvan (terminen)
    try {
      await Promise.all(updatePromises);

      // Si llegamos aquí, todas las actualizaciones (Auth y Firestore) fueron exitosas:

      // MUESTRO EL MENSAJE DE ÉXITO
      mensajeExito.textContent =
        "✅ ¡Perfil actualizado exitosamente! Redirigiendo...";
      mensajeExito.style.display = "block";

      // Limpiamos la contraseña y recargamos datos para reflejar los cambios
      passwordInput.value = "";
      cargarDatosUsuario(userUID);

      // setTimeout() ejecuta la función de redirección después de 5 segundos (5000 ms),
      // dándole tiempo al usuario para ver el mensaje de éxito.
      setTimeout(() => {
        window.location.href = "index.html"; // Redirige a la página principal
      }, 500);
    } catch (error) {
      // Si ocurre un error en cualquiera de las promesas, el control salta a este bloque catch:
      console.error("Error al actualizar perfil:", error);

      let errorMessage = ` Error al actualizar el perfil: ${error.message}`;

      // Manejamos el error específico si Firebase pide iniciar sesión de nuevo por seguridad
      if (error.code === "auth/requires-recent-login") {
        errorMessage =
          "Por tu seguridad, debes cerrar sesión e iniciarla de nuevo antes de cambiar tu Email o Contraseña.";
      }

      // MUESTRO EL MENSAJE DE ERROR
      mensajeError.textContent = errorMessage;
      mensajeError.style.display = "block";
    }
  });
});
