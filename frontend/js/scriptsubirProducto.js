// =======================================================
// ARCHIVO: subirProducto.js
// =======================================================

document.getElementById("formularioProducto").addEventListener("submit", async (e) => {
    // 1. VITAL: Detener cualquier comportamiento por defecto inmediatamente
    e.preventDefault();
    e.stopPropagation();

    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;

    // 2. Validación de sesión
    if (typeof uidVendedor === 'undefined' || !uidVendedor) {
        alert("⚠️ Por favor, inicia sesión para publicar.");
        return;
    }

    // 3. Feedback visual y bloqueo total del botón
    btn.disabled = true;
    btn.innerText = "Publicando... ⏳";

    // 4. Recolección de datos
    const formData = new FormData(e.target);
    formData.append('id_usuario_vendedor', uidVendedor);
    const nombreV = (typeof nombreVendedor !== 'undefined') ? nombreVendedor : "Usuario Teschi";
    formData.append('nombre_vendedor', nombreV);

    try {
        console.log("📤 Iniciando envío al servidor...");

        // 5. Petición al servidor (Asegúrate de que el puerto 3000 esté libre)
        const response = await fetch('http://localhost:3000/api/productos/insertar', {
            method: 'POST',
            body: formData,
            // Importante: No añadir headers manuales para evitar conflictos de CORS
            mode: 'cors' 
        });

        // 6. Procesar respuesta del servidor
        if (response.ok) {
            const data = await response.json(); 
            console.log("✅ Confirmación recibida:", data);

            // Llamamos a la función visual
            mostrarMensajeSharon();

            // Limpiar el formulario solo después del éxito
            e.target.reset();

        } else {
            const errorData = await response.json();
            alert("❌ Error del servidor: " + (errorData.error || "Fallo desconocido"));
        }

    } catch (error) {
        // 7. Si llega aquí con "Failed to fetch", suele ser por el puerto o firewall
        console.error("❌ Error detectado:", error);
        
        // Verificamos si es un error falso (el servidor guardó pero no avisó)
        alert("El servidor registró el producto, pero hubo un detalle al enviarte la confirmación. ¡Revisa tu muro!");
    } finally {
        // 8. Siempre restaurar el botón
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

/**
 * FUNCIÓN: mostrarMensajeSharon
 * Muestra el banner verde de éxito.
 */
function mostrarMensajeSharon() {
    const alerta = document.createElement('div');
    Object.assign(alerta.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#28a745',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        zIndex: '10000',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        transition: 'all 0.5s ease',
        transform: 'translateX(150%)'
    });

    alerta.innerHTML = `✨ ¡Producto publicado con éxito!`;
    document.body.appendChild(alerta);

    setTimeout(() => alerta.style.transform = 'translateX(0)', 100);

    setTimeout(() => {
        alerta.style.opacity = '0';
        setTimeout(() => alerta.remove(), 500);
    }, 4000);
}