// Referencias a los elementos del DOM
const nombreCard = document.getElementById('display-name');
const emailCard = document.getElementById('display-email');
const nombreInput = document.getElementById('nombre');
const emailInput = document.getElementById('email');
const telefonoInput = document.getElementById('telefono');
const perfilForm = document.getElementById('perfilForm');
const btnCerrarSesion = document.getElementById('btnCerrarSesion');

// 1. Escuchar el estado de la autenticación
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("Usuario detectado:", user.email);
        cargarDatosPerfil(user);
    } else {
        // Si no hay usuario, redirigir al login
        window.location.href = "login.html";
    }
});

// 2. Función para obtener datos de Firestore y llenar la interfaz
async function cargarDatosPerfil(user) {
    try {
        const db = firebase.firestore();
        // Buscamos el documento del usuario en la colección 'usuarios' usando su UID
        const doc = await db.collection('usuarios').doc(user.uid).get();

        if (doc.exists) {
            const datos = doc.data();

            // Rellenar la tarjeta de la izquierda (Sidebar)
            nombreCard.textContent = datos.nombre || "Usuario sin nombre";
            emailCard.textContent = user.email;

            // Rellenar el formulario de la derecha
            nombreInput.value = datos.nombre || "";
            emailInput.value = user.email; // El email viene de Auth
            telefonoInput.value = datos.telefono || "";
            
        } else {
            // Si el documento no existe en Firestore, usamos datos básicos de Auth
            nombreCard.textContent = user.displayName || "Nuevo Usuario";
            emailCard.textContent = user.email;
            nombreInput.value = user.displayName || "";
            emailInput.value = user.email;
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
}

// 3. Manejar el envío del formulario para actualizar
perfilForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    const mensajeExito = document.getElementById('mensajeExito');
    const mensajeError = document.getElementById('mensajeError');

    const nuevosDatos = {
        nombre: nombreInput.value,
        telefono: telefonoInput.value,
        ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // Actualizar Firestore
        await firebase.firestore().collection('usuarios').doc(user.uid).update(nuevosDatos);
        
        // Actualizar visualmente la tarjeta izquierda inmediatamente
        nombreCard.textContent = nombreInput.value;

        // Si el usuario escribió una contraseña, actualizarla en Auth
        const nuevaPass = document.getElementById('password').value;
        if (nuevaPass.length >= 6) {
            await user.updatePassword(nuevaPass);
        }

        mensajeExito.textContent = "¡Perfil actualizado correctamente!";
        setTimeout(() => mensajeExito.textContent = "", 3000);

    } catch (error) {
        mensajeError.textContent = "Error: " + error.message;
        console.error(error);
    }
});

// 4. Botón de Cerrar Sesión
btnCerrarSesion.addEventListener('click', () => {
    firebase.auth().signOut().then(() => {
        window.location.href = "login.html";
    });
});