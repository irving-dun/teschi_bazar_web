document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    if (!idProducto) {
        console.error("No se encontró el ID del producto en la URL");
        return;
    }

    try {
        const servidorUrl = "http://127.0.0.1:3000";
        const respuesta = await fetch(`${servidorUrl}/api/productos/${idProducto}`);
        
        if (!respuesta.ok) throw new Error("Error al obtener datos del servidor");
        
        const producto = await respuesta.json();

        // 1. Llenar textos básicos
        document.getElementById('nombreProducto').textContent = producto.nombre_producto;
        document.getElementById('precioProducto').textContent = `$${parseFloat(producto.precio).toFixed(2)} MXN`;
        document.getElementById('detalleDescripcion').textContent = producto.descripcion;
        document.getElementById('detalleCategoria').textContent = producto.nombre_categoria;
        document.getElementById('detalleEstado').textContent = producto.estado_producto;
        document.getElementById('detalleDisponibilidad').textContent = `${producto.disponibilidad} unidades`;
        document.getElementById('detalleUbicacionEntrega').textContent = producto.ubicacion_entrega;

        // --- CORRECCIÓN AQUÍ: Obtener nombre desde Firebase ---
        const idVendedor = producto.id_usuario_vendedor;
        if (idVendedor) {
            // Llamamos a la función para buscar el nombre real
            obtenerNombreVendedor(idVendedor);
        } else {
            document.getElementById('detalleNombreVendedor').textContent = "Vendedor no especificado";
        }

        // 2. FORMATEO DE FECHA
        if (producto.fecha_publicacion) {
            const fecha = new Date(producto.fecha_publicacion);
            const opciones = { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            const fechaFormateada = fecha.toLocaleDateString('es-ES', opciones);
            document.getElementById('detalleFechaPublicacion').textContent = fechaFormateada;
        } else {
            document.getElementById('detalleFechaPublicacion').textContent = "Fecha no disponible";
        }

        // 3. Cargar la imagen
        if (producto.url_imagen) {
            document.getElementById('mainProductImage').src = `${servidorUrl}${producto.url_imagen}`;
        }

    } catch (error) {
        console.error("Error al cargar el detalle:", error);
        alert("No se pudo cargar la información del producto.");
    }
});

/**
 * Función para obtener el nombre del usuario desde Firebase Firestore
 */
async function obtenerNombreVendedor(uid) {
    const spanVendedor = document.getElementById('detalleNombreVendedor');
    const chatVendedorInfo = document.getElementById('chat-vendedor-info');

    try {
        // Accedemos a la colección 'usuarios' (ajusta el nombre si en tu Firebase es diferente)
        const userDoc = await firebase.firestore().collection('usuarios').doc(uid).get();

        if (userDoc.exists) {
            const datosUsuario = userDoc.data();
            // Usamos 'nombre' (asegúrate que así se llame el campo en tu Firebase)
            const nombreReal = datosUsuario.nombre || "Usuario sin nombre";
            
            spanVendedor.textContent = nombreReal;

            // También actualizamos el nombre en la ventana del chat si existe
            if (chatVendedorInfo) {
                chatVendedorInfo.textContent = `Vendedor: ${nombreReal}`;
            }
        } else {
            spanVendedor.textContent = "Vendedor no encontrado";
            console.warn("No se encontró el documento del usuario en Firebase con UID:", uid);
        }
    } catch (error) {
        console.error("Error al obtener datos del vendedor en Firebase:", error);
        spanVendedor.textContent = "Error al cargar nombre";
    }
}