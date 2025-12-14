document.addEventListener("DOMContentLoaded", () => {
  // --- Elementos del DOM ---
  const contenedorPrincipal = document.getElementById("contenedor-principal");
  const registroForm = document.getElementById("registroForm");
  const loginForm = document.getElementById("loginForm");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const loginmensajeError = document.getElementById("login-error-mensaje");
  const perfilCargadoContainer = document.getElementById("perfil-cargado"); // Lo mantenemos por si lo usas en el futuro

  if (!contenedorPrincipal) {
    console.error(
      "Error: Elemento 'contenedor-principal' no encontrado. Revisa tu HTML."
    );
    return;
  }

  // --- Control de las Animaciones --
  const registraSesionButton = document.getElementById("signUp");
  const iniciaSesionBoton = document.getElementById("signIn");

  if (registraSesionButton && iniciaSesionBoton) {
    registraSesionButton.addEventListener("click", () => {
      contenedorPrincipal.classList.add("right-panel-active");
    });

    iniciaSesionBoton.addEventListener("click", () => {
      contenedorPrincipal.classList.remove("right-panel-active");
    });
  }

  // ===============================================
  // === 1. MANEJO DE REGISTRO (SIGN UP) - CON REDIRECCIÓN ===
  // ===============================================
  if (registroForm) {
    registroForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nombre = document.getElementById("reg-nombre").value;
      const email = document.getElementById("reg-email").value;
      const telefono = document.getElementById("reg-telefono").value;
      const password = document.getElementById("reg-password").value;

      if (password.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      // Se asume que 'auth' y 'db' son variables globales definidas en firebase-config.js
      firebase
        .auth()
        .createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          const user = userCredential.user;
          // 2. GUARDAR DATOS ADICIONALES EN FIRESTORE
          return db.collection("usuarios").doc(user.uid).set({
            nombre: nombre,
            telefono: telefono,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        })
        .then(() => {
          alert(`¡Registro exitoso! Tu perfil ha sido creado. Redirigiendo...`);
          // Redirección al index después de un registro exitoso
          window.location.href = "index.html";
        })
        .catch((error) => {
          let mensaje = "Error de Registro. Por favor, intente de nuevo.";
          if (error.code === "auth/email-already-in-use") {
            mensaje = "Ese correo electrónico ya está registrado.";
          } else if (error.code === "auth/invalid-email") {
            mensaje = "El formato del correo electrónico es inválido.";
          }
          console.error("Error detallado de registro:", error);
          alert(mensaje);
        });
    });
  }

  // ===============================================
  // === 2. MANEJO DE INICIO DE SESION- ===
  // ===============================================
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (loginmensajeError) {
        loginmensajeError.style.display = "none";
        loginmensajeError.textContent = "";
      }

      const email = document.getElementById("log-email").value;
      const password = document.getElementById("log-password").value;

      // Se asume que 'auth' es una variable global definida en firebase-config.js
      firebase
        .auth()
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          alert("¡Inicio de sesión exitoso! Redirigiendo a tu perfil...");
          //  Redirección después de un inicio de sesión exitoso
          window.location.href = "index.html";
        })
        .catch((error) => {
          let mensaje = "Error de inicio de sesión. Credenciales incorrectas.";
          if (
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password"
          ) {
            mensaje = "Correo o contraseña inválidos.";
          } else if (error.code === "auth/invalid-email") {
            mensaje = "El formato del correo electronico es incorrecto.";
          }
          if (loginmensajeError) {
            loginmensajeError.textContent = "ALERTA " + mensaje;
            loginmensajeError.style.display = "block"; //hacemos visible el mensaje o el div
          }
        });
    });
  }

  // ===============================================
  // === 4. ESTADO DE LA SESIÓN (Redirección si ya está logueado) ===
  // ===============================================

  // Esta función verifica la sesión. Si hay una sesión activa, redirige inmediatamente.
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // SESIÓN ACTIVA: Redirigir inmediatamente a la página principal
      console.log(
        "Sesión activa detectada en login.html. Redirigiendo a index.html"
      );

      // Oculta temporalmente la interfaz de login (opcional)
      if (contenedorPrincipal) {
        contenedorPrincipal.style.display = "none";
      }
      // Muestra un mensaje de redirección
      if (perfilCargadoContainer) {
        perfilCargadoContainer.style.display = "block";
        perfilCargadoContainer.innerHTML = `<div style="padding: 50px; text-align: center;"><h1>¡Bienvenido! Redirigiendo...</h1></div>`;
      }

      // Realiza la redirección
      window.location.href = "index.html";
    } else {
      // NO HAY SESIÓN: Mostramos formularios de Login/Registro
      if (contenedorPrincipal) {
        contenedorPrincipal.style.display = "flex"; // Mostramos la interfaz de login
      }
      if (perfilCargadoContainer) {
        // Aseguramos que el contenedor de perfil esté oculto
        perfilCargadoContainer.style.display = "none";
        perfilCargadoContainer.innerHTML = "";
      }
    }
  });

  // ===============================================
  // === FUNCIÓN DE CERRAR SESIÓN (Para index.html y login.html) ===
  // ===============================================

  window.logoutFirebase = function () {
    firebase
      .auth()
      .signOut()
      .then(() => {
        // Redirigimos a login.html después de cerrar sesión
        alert(
          "Sesión cerrada. Serás redirigido a la página de inicio de sesión."
        );
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Error al cerrar sesión:", error);
        alert("Ocurrió un error al cerrar la sesión.");
      });
  };
});
