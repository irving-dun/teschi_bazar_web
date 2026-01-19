document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idProducto = urlParams.get('id');

    if (!idProducto) {
        console.error("No se encontró el ID del producto en la URL");
        return;
    }

    try {

        const servidorUrl = "https://teschi-bazar-web.onrender.com";
        const respuesta = await fetch(`${servidorUrl}/api/productos/${idProducto}`);
        
        if (!respuesta.ok) throw new Error("Error al obtener datos del servidor");
        
        const producto = await respuesta.json();


        document.getElementById('nombreProducto').textContent = producto.nombre_producto;
        document.getElementById('precioProducto').textContent = `$${parseFloat(producto.precio).toFixed(2)} MXN`;
        document.getElementById('detalleDescripcion').textContent = producto.descripcion;
        document.getElementById('detalleCategoria').textContent = producto.nombre_categoria;
        document.getElementById('detalleEstado').textContent = producto.estado_producto;
        document.getElementById('detalleDisponibilidad').textContent = `${producto.disponibilidad} unidades`;
        document.getElementById('detalleUbicacionEntrega').textContent = producto.ubicacion_entrega;
        
      
        if (producto.id_usuario_vendedor) {
            obtenerNombreVendedor(producto.id_usuario_vendedor);
        } else {
            document.getElementById('detalleNombreVendedor').textContent = "Vendedor no especificado";
        }

        
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

        //  Cargar la imagen (CAMBIADO PARA CLOUDINARY)
        if (producto.url_imagen) {
            const mainImg = document.getElementById('mainProductImage');
         
            const urlImagenFinal = producto.url_imagen.startsWith('http') 
                ? producto.url_imagen 
                : `${servidorUrl}${producto.url_imagen}`;
            
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
            const nombreReal = userDoc.data().nombre;
            document.getElementById('detalleNombreVendedor').textContent = nombreReal || "Usuario sin nombre";
        } else {
            document.getElementById('detalleNombreVendedor').textContent = "Vendedor no encontrado";
        }
    } catch (error) {
        console.error("Error al obtener nombre:", error);
        document.getElementById('detalleNombreVendedor').textContent = "Error al cargar nombre";
    }
}