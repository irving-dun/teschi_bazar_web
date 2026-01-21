document.addEventListener("DOMContentLoaded", () => {
    // --- Elementos del DOM ---
    const contenedorPrincipal = document.getElementById("contenedor-principal");
    const registroForm = document.getElementById("registroForm");
    const loginForm = document.getElementById("loginForm");
    const loginmensajeError = document.getElementById("login-error-mensaje");
    const perfilCargadoContainer = document.getElementById("perfil-cargado");

    let estaRegistrando = false; 

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
    // === 1. MANEJO DE REGISTRO ===
    // ===============================================
    if (registroForm) {
        registroForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            estaRegistrando = true; 

            const nombre = document.getElementById("reg-nombre").value.trim();
            const email = document.getElementById("reg-email").value.trim();
            const telefono = document.getElementById("reg-telefono").value.trim();
            const password = document.getElementById("reg-password").value;

            if (!nombre || !email || !telefono || !password) {
                alert("Por favor, llena todos los campos.");
                estaRegistrando = false;
                return;
            }

            try {
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // GUARDAR EN FIRESTORE
                // Usamos firebase.firestore() directamente para evitar errores si 'db' no fue definida globalmente
                await firebase.firestore().collection("usuarios").doc(user.uid).set({
                    nombre: nombre,
                    telefono: telefono,
                    email: email,
                    uid: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert("¡Cuenta creada con éxito! Bienvenido.");
                window.location.href = "index.html";

            } catch (error) {
                estaRegistrando = false;
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
            if (loginmensajeError) loginmensajeError.style.display = "none";

            const email = document.getElementById("log-email").value.trim();
            const password = document.getElementById("log-password").value;

            firebase.auth().signInWithEmailAndPassword(email, password)
                .then(() => {
                    // No hace falta alert aquí si queremos que sea rápido
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
    // === 3. ESTADO DE LA SESIÓN ===
    // ===============================================
    firebase.auth().onAuthStateChanged((user) => {
        if (user && !estaRegistrando) { 
            // Si ya está logueado, no mostramos el form, vamos directo al inicio
            window.location.replace("index.html"); // .replace evita que el usuario regrese al login con el botón 'atrás'
        } else if (!user) {
            if (contenedorPrincipal) contenedorPrincipal.style.display = "flex";
        }
    });
});