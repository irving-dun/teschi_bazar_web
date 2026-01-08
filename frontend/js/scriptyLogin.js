document.addEventListener("DOMContentLoaded", () => {
    // --- Elementos del DOM ---
    const contenedorPrincipal = document.getElementById("contenedor-principal");
    const registroForm = document.getElementById("registroForm");
    const loginForm = document.getElementById("loginForm");
    const loginmensajeError = document.getElementById("login-error-mensaje");
    const perfilCargadoContainer = document.getElementById("perfil-cargado");

    // Variable para evitar que la redirección automática interrumpa el guardado en Firestore
    let estaRegistrando = false; 

    if (!contenedorPrincipal) {
        console.error("Error: Elemento 'contenedor-principal' no encontrado.");
        return;
    }

    // --- Control de las Animaciones ---
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
    // === 1. MANEJO DE REGISTRO (CON PAUSA DE CONTROL) ===
    // ===============================================
    if (registroForm) {
        registroForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            estaRegistrando = true; // Bloqueamos la redirección automática

            const nombre = document.getElementById("reg-nombre").value;
            const email = document.getElementById("reg-email").value;
            const telefono = document.getElementById("reg-telefono").value;
            const password = document.getElementById("reg-password").value;

            try {
                // 1. Crear en Auth
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                console.log("1. Usuario creado en Auth:", user.uid);

                // 2. GUARDAR EN FIRESTORE (Esperamos confirmación real)
                console.log("2. Guardando datos en Firestore...");
                await db.collection("usuarios").doc(user.uid).set({
                    nombre: nombre,
                    telefono: telefono,
                    email: email,
                    uid: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log("3. ¡Datos guardados exitosamente!");
                alert("¡Cuenta creada con éxito! Bienvenido.");
                
                // 4. Redirección manual una vez que Firestore confirmó
                window.location.href = "index.html";

            } catch (error) {
                estaRegistrando = false; // Liberamos la bandera si hubo error
                console.error("Error en registro:", error);
                alert("Error: " + error.message);
            }
        });
    }

    // ===============================================
    // === 2. MANEJO DE INICIO DE SESIÓN ===
    // ===============================================
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if (loginmensajeError) {
                loginmensajeError.style.display = "none";
            }

            const email = document.getElementById("log-email").value;
            const password = document.getElementById("log-password").value;

            firebase.auth().signInWithEmailAndPassword(email, password)
                .then(() => {
                    alert("¡Inicio de sesión exitoso!");
                    window.location.href = "index.html";
                })
                .catch((error) => {
                    console.error("Error login:", error);
                    if (loginmensajeError) {
                        loginmensajeError.textContent = "ALERTA: Correo o contraseña incorrectos.";
                        loginmensajeError.style.display = "block";
                    }
                });
        });
    }

    // ===============================================
    // === 3. ESTADO DE LA SESIÓN (REDIRECCIÓN AUTOMÁTICA) ===
    // ===============================================
    firebase.auth().onAuthStateChanged((user) => {
        // SI hay usuario Y NO estamos registrando, redirigimos
        if (user && !estaRegistrando) { 
            console.log("Sesión activa detectada. Redirigiendo a index.html");
            if (contenedorPrincipal) contenedorPrincipal.style.display = "none";
            if (perfilCargadoContainer) {
                perfilCargadoContainer.style.display = "block";
                perfilCargadoContainer.innerHTML = `<div style="text-align: center;"><h1>Cargando perfil...</h1></div>`;
            }
            window.location.href = "index.html";
        } else if (!user) {
            // No hay sesión, mostramos el login
            if (contenedorPrincipal) contenedorPrincipal.style.display = "flex";
            if (perfilCargadoContainer) perfilCargadoContainer.style.display = "none";
        }
    });

    // --- Cerrar Sesión ---
    window.logoutFirebase = function () {
        firebase.auth().signOut().then(() => {
            alert("Sesión cerrada.");
            window.location.href = "login.html";
        });
    };
});