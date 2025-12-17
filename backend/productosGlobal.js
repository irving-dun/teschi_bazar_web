// js/productos.js - Script Global para cargar productos por categoría

const BASE_URL_API = 'http://localhost:3000'; // ⚠️ AJUSTA ESTA URL si tu servidor Express no corre en localhost:3000

/**
 * Genera el HTML de la tarjeta de producto.
 * @param {Object} producto - Un objeto producto retornado por la API.
 */
function crearTarjetaProductoHTML(producto) {
    // Construye la URL de la imagen usando la base del servidor y la ruta de la BD
    const imagenSrc = `${BASE_URL_API}${producto.imagen_url}`;
    const precioFormateado = `$${parseFloat(producto.precio).toFixed(2)}`;

    // Estructura HTML que coincide con tu CSS existente
    return `
        <div class="producto-card" id="producto-${producto.id_producto}">
            <div class="imagen-contenedor">
                <img src="${imagenSrc}" alt="${producto.nombre_producto}" />
            </div>
            <div class="info-contenedor">
                <h3 class="titulo-producto">${producto.nombre_producto}</h3>
                <p class="precio">${precioFormateado}</p>
                <button class="btn-contacto" data-producto-id="${producto.id_producto}">Contactar</button>
            </div>
        </div>
    `;
}

/**
 * Función principal que lee el data-categoria-id y carga los productos.
 */
async function cargarProductosPorCategoria() {
    const mainElement = document.querySelector('main[data-categoria-id]');
    
    // Si la etiqueta main no tiene el atributo data-categoria-id, salimos (ej: en index.html)
    if (!mainElement) return; 

    const categoriaId = mainElement.dataset.categoriaId;
    const contenedor = document.getElementById('productos-contenedor-dinamico');

    if (!contenedor) {
        console.error("Error: No se encontró el contenedor 'productos-contenedor-dinamico'.");
        return;
    }
    
    contenedor.innerHTML = '<p>Cargando artículos...</p>';

    try {
        // 1. Llamada a la API
        const response = await fetch(`${BASE_URL_API}/api/productos/categoria/${categoriaId}`);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo obtener la categoría ${categoriaId}.`);
        }
        
        const productos = await response.json();

        // 2. Renderizado
        if (productos.length === 0) {
            contenedor.innerHTML = '<p>No hay artículos disponibles en esta categoría.</p>';
            return;
        }

        // Mapea los productos de la BD a tarjetas HTML
        const productosHTML = productos.map(crearTarjetaProductoHTML).join('');
        contenedor.innerHTML = productosHTML;

        // 3. Asignar evento al botón de chat
        document.querySelectorAll('.btn-contacto').forEach(button => {
            button.addEventListener('click', (e) => {
                const idProducto = e.target.dataset.productoId;
                manejarChat(idProducto); // Llama a la función de chat
            });
        });

    } catch (error) {
        console.error('Error al cargar los productos de la BD:', error);
        contenedor.innerHTML = '<p class="error">Lo sentimos, hubo un problema al cargar los artículos.</p>';
    }
}

// Lógica de manejo de chat (a integrar con Firebase y Socket.IO)
function manejarChat(idProducto) {
    // ⚠️ IMPLEMENTACIÓN DE CHAT PENDIENTE: Aquí necesitas obtener el ID del usuario logueado 
    // y usar el socket.io para enviarle un mensaje al vendedor (tu backend lo soporta).
    alert(`Producto ID: ${idProducto}. Debes iniciar sesión para contactar al vendedor.`);
}

// Ejecutar la función cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', cargarProductosPorCategoria);