document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    if (!idProducto) {
        console.error("No se encontró el ID del producto en la URL");
        return;
    }

    try {
        // CAMBIO: Usamos API_BASE_URL (definida en firebase-config.js)
        const respuesta = await fetch(`${API_BASE_URL}/api/productos/${idProducto}`);
        
        if (!respuesta.ok) throw new Error("Error al obtener datos del servidor");
        
        const producto = await respuesta.json();

        // Llenado de datos básicos
        document.getElementById('nombreProducto').textContent = producto.nombre_producto;
        document.getElementById('precioProducto').textContent = `$${parseFloat(producto.precio).toFixed(2)} MXN`;
        document.getElementById('detalleDescripcion').textContent = producto.descripcion;
        document.getElementById('detalleCategoria').textContent = producto.nombre_categoria;
        document.getElementById('detalleEstado').textContent = producto.estado_producto;
        document.getElementById('detalleDisponibilidad').textContent = `${producto.disponibilidad} unidades`;
        document.getElementById('detalleUbicacionEntrega').textContent = producto.ubicacion_entrega;
        
        // CAMBIO: Guardamos el UID real del vendedor en un atributo de datos para que scriptCompra lo use
        const vendedorSpan = document.getElementById('detalleNombreVendedor');
        if (producto.id_usuario_vendedor) {
            vendedorSpan.setAttribute('data-uid-vendedor', producto.id_usuario_vendedor);
            obtenerNombreVendedor(producto.id_usuario_vendedor);
        } else {
            vendedorSpan.textContent = "Vendedor no especificado";
        }

        // Formateo de fecha
        if (producto.fecha_publicacion) {
            const fecha = new Date(producto.fecha_publicacion);
            const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
            document.getElementById('detalleFechaPublicacion').textContent = fecha.toLocaleDateString('es-ES', opciones);
        }

        // Lógica de Imagen (Soporte Cloudinary e Híbrido)
        if (producto.url_imagen) {
            const mainImg = document.getElementById('mainProductImage');
            // CAMBIO: Si la URL empieza con http, es Cloudinary. Si no, es ruta de Render.
            const urlImagenFinal = producto.url_imagen.startsWith('http') 
                ? producto.url_imagen 
                : `${API_BASE_URL}${producto.url_imagen}`;
            
            mainImg.src = urlImagenFinal;
        }

    } catch (error) {
        console.error("Error al cargar el detalle:", error);
        alert("No se pudo cargar la información del producto.");
    }
});

async function obtenerNombreVendedor(uid) {
    try {
        const userDoc = await firebase.firestore().collection('usuarios').doc(uid).get();
        if (userDoc.exists) {
            document.getElementById('detalleNombreVendedor').textContent = userDoc.data().nombre || "Usuario sin nombre";
        }
    } catch (error) {
        console.error("Error al obtener nombre:", error);
    }
}