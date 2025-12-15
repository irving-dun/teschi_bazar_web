// Contenido de ../../frontend/js/scriptCategorias.js (Script general para todas las categorías)

const BACKEND_URL = 'http://localhost:3000'; // ⚠️ CAMBIA ESTO por la URL de tu servidor en Render cuando sea necesario.

// Función para crear la tarjeta de producto (DOM Element)
function crearTarjetaProducto(producto) {
    const url_imagen = producto.url_imagen ? `${BACKEND_URL}${producto.url_imagen}` : '/frontend/imgProductos/default.png';
    const precio_formateado = `$${parseFloat(producto.precio).toFixed(2)}`;

    const card = document.createElement('div');
    card.classList.add('producto-card');
    card.id = `producto-${producto.id_producto}`;
    
    card.innerHTML = `
        <div class="imagen-contenedor">
            <img src="${url_imagen}" alt="${producto.nombre_producto}" />
        </div>
        <div class="info-contenedor">
            <h3 class="titulo-producto">${producto.nombre_producto}</h3>
            <p class="precio">${precio_formateado}</p>
        </div>
    `;
    
    card.addEventListener('click', () => {
        // Redirigir a la página de detalle
        // window.location.href = `detalle_producto.html?id=${producto.id_producto}`; 
        console.log(`Clic en producto: ${producto.id_producto}`);
    });

    return card;
}

// Función principal para cargar productos de la categoría
async function cargarProductosPorCategoria(idCategoria) {
    const grid = document.querySelector('.productos-grid');
    grid.innerHTML = '<p>Cargando productos...</p>';

    try {
        // Llama a la API usando el ID extraído del HTML
        const response = await fetch(`${BACKEND_URL}/api/productos/categoria/${idCategoria}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            grid.innerHTML = `<p>Error al cargar productos: ${errorData.mensaje || errorData.error || 'No se pudo obtener la lista de productos.'}</p>`;
            return;
        }

        const productos = await response.json();

        grid.innerHTML = ''; // Limpiar el mensaje de carga
        if (productos.length === 0) {
            grid.innerHTML = '<p>No hay productos disponibles en esta categoría.</p>';
            return;
        }
        
        // Renderizar productos
        productos.forEach(producto => {
            const card = crearTarjetaProducto(producto);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Fallo en la conexión con la API:', error);
        grid.innerHTML = '<p>Lo sentimos, no se pudo conectar con el servidor.</p>';
    }
}

// 💥 LÓGICA GENERAL DE INICIO (Detecta el ID de categoría en la página)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el ID de categoría del atributo data-category-id del título <h2>
    const tituloCategoria = document.querySelector('h2[data-category-id]');
    
    if (tituloCategoria) {
        const idCategoria = parseInt(tituloCategoria.getAttribute('data-category-id'));
        
        if (!isNaN(idCategoria)) {
            // 2. Si el ID es válido (ej: 9 para ropa), se inicia la carga.
            console.log(`Cargando productos para la Categoría ID: ${idCategoria}`);
            cargarProductosPorCategoria(idCategoria);
        } else {
            console.error('El ID de categoría encontrado no es un número válido.');
            document.querySelector('.productos-grid').innerHTML = '<p>Error de configuración: ID de categoría no válido en el H2.</p>';
        }
    } else {
        console.error('No se encontró el elemento <h2> con el atributo data-category-id. Asegúrate de agregarlo.');
        document.querySelector('.productos-grid').innerHTML = '<p>Error de configuración: No se pudo identificar la categoría.</p>';
    }
});