document.addEventListener("DOMContentLoaded", () => {
    // Referencias Sidebar (Tarjeta Izquierda)
    const nombreCard = document.getElementById('display-name');
    const emailCard = document.getElementById('display-email');
    
    // Referencias Formulario (Centro)
    const perfilForm = document.getElementById("perfilForm");
    const nombreInput = document.getElementById("nombre");
    const emailInput = document.getElementById("email");
    const telefonoInput = document.getElementById("telefono");
    const passwordInput = document.getElementById("password");
    const mensajeError = document.getElementById("mensajeError");
    const mensajeExito = document.getElementById("mensajeExito");
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');

    let currentUser = null;

    // 1. CARGA DE DATOS (Firestore + Auth)
    async function cargarDatosPerfil(user) {
        try {
            const doc = await firebase.firestore().collection("usuarios").doc(user.uid).get();
            
            // Siempre llenamos con lo que tenemos en Auth primero
            nombreCard.textContent = user.displayName || "Usuario";
            emailCard.textContent = user.email;
            emailInput.value = user.email;

            if (doc.exists) {
                const datos = doc.data();
                // Si hay datos en Firestore, sobreescribimos con la info real
                nombreCard.textContent = datos.nombre || "Usuario";
                nombreInput.value = datos.nombre || "";
                telefonoInput.value = datos.telefono || "";
            }
        } catch (error) {
            console.error("Error al cargar perfil:", error);
        }
    }

    // 2. OBSERVADOR DE SESIÓN
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            cargarDatosPerfil(user);
        } else {
            // Redirección limpia al login
            window.location.replace("login.html");
        }
    });

    // 3. GUARDAR CAMBIOS (Submit)
    perfilForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        mensajeError.textContent = "";
        mensajeExito.textContent = "";

        if (!currentUser) return;

        try {
            // A. Actualizar Firestore (Nombre y Teléfono)
            await firebase.firestore().collection("usuarios").doc(currentUser.uid).update({
                nombre: nombreInput.value.trim(),
                telefono: telefonoInput.value.trim(),
                ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Actualizar visualmente la tarjeta izquierda
            nombreCard.textContent = nombreInput.value;

            // B. Actualizar Contraseña (si el campo no está vacío)
            const nuevaPass = passwordInput.value;
            if (nuevaPass) {
                if (nuevaPass.length >= 6) {
                    await currentUser.updatePassword(nuevaPass);
                    passwordInput.value = ""; // Limpiar campo
                } else {
                    throw new Error("La contraseña debe tener al menos 6 caracteres.");
                }
            }

            mensajeExito.textContent = "✅ ¡Perfil actualizado correctamente!";
            setTimeout(() => mensajeExito.textContent = "", 4000);

        } catch (error) {
            console.error(error);
            if (error.code === "auth/requires-recent-login") {
                mensajeError.textContent = "Por seguridad, debes re-iniciar sesión para cambiar tu contraseña.";
            } else {
                mensajeError.textContent = error.message;
            }
        }
    });

    // 4. CERRAR SESIÓN
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            firebase.auth().signOut().then(() => {
                window.location.replace("login.html");
            });
        });
    }
});