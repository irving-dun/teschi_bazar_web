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
        document.getElementById('detalleNombreVendedor').textContent = producto.id_usuario_vendedor;

        // 2. AQUÍ AGREGAS EL FORMATEO DE FECHA
        if (producto.fecha_publicacion) {
            const fecha = new Date(producto.fecha_publicacion);
            
            // Configuración para que diga: "17 de diciembre de 2025"
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




