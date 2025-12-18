document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    if (!idProducto) return;

    try {
        const servidorUrl = "http://127.0.0.1:3000";
        const respuesta = await fetch(`${servidorUrl}/api/productos/${idProducto}`);
        const producto = await respuesta.json();
        // Dentro del bloque try después de obtener el objeto 'producto'
const fechaRaw = producto.fecha_publicacion; 
if (fechaRaw) {
    const fecha = new Date(fechaRaw);
    // Formato legible: "15/12/2025"
    document.getElementById('detalleFechaPublicacion').textContent = fecha.toLocaleDateString();
} else {
    document.getElementById('detalleFechaPublicacion').textContent = "Fecha no disponible";
}

        // Llenar el HTML
        document.getElementById('nombreProducto').textContent = producto.nombre_producto;
        document.getElementById('precioProducto').textContent = `$${parseFloat(producto.precio).toFixed(2)} MXN`;
        document.getElementById('detalleDescripcion').textContent = producto.descripcion;
        document.getElementById('detalleCategoria').textContent = producto.nombre_categoria;
        document.getElementById('detalleEstado').textContent = producto.estado_producto;
        document.getElementById('detalleDisponibilidad').textContent = producto.disponibilidad;
        document.getElementById('detalleUbicacionEntrega').textContent = producto.ubicacion_entrega;
        document.getElementById('detalleNombreVendedor').textContent = producto.id_usuario_vendedor;

        if (producto.url_imagen) {
            document.getElementById('mainProductImage').src = `${servidorUrl}${producto.url_imagen}`;
        }
    } catch (error) {
        console.error("Error:", error);
    }
});