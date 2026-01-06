const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
// Asegúrate de que este ID coincida con el de tu HTML donde se muestran los productos
const contenedorResultados = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');

const servidorUrl = "http://localhost:3000"; 
let debounceTimeout = null;

// --- BUSQUEDA EN TIEMPO REAL ---
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);

    if (query.length === 0) return;

    debounceTimeout = setTimeout(() => {
        ejecutarBusqueda(query);
    }, 500);
});

// --- BUSQUEDA POR BOTÓN O ENTER ---
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounceTimeout);
    ejecutarBusqueda(searchInput.value.trim());
});

// --- FUNCIÓN DE PETICIÓN ---
async function ejecutarBusqueda(query) {
    if (query.length < 2) return;

    try {
        const response = await fetch(`${servidorUrl}/api/buscar?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Error en el servidor");
        
        const productos = await response.json();
        renderizarInterfazFusionada(productos, query);

    } catch (error) {
        console.error("Error al buscar:", error);
    }
}

// --- FUNCIÓN DE INTERFAZ (ESTÉTICA MEJORADA) ---
function renderizarInterfazFusionada(productos, termino) {
    contenedorResultados.innerHTML = ''; 

    if (productos.length === 0) {
        contenedorResultados.innerHTML = `<h3 class="no-results">No se encontraron resultados para "${termino}"</h3>`;
        return;
    }

    productos.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'producto-card'; // Usa la clase de tu CSS principal
        
        // Mantenemos la funcionalidad clickeable de tu código de categorías
        card.style.cursor = 'pointer';
        card.onclick = () => {
            window.location.href = `detalleProducto.html?id=${prod.id_producto}`;
        };

        // Lógica de imagen fusionada (soluciona el error 404 de tus capturas)
        const urlImagenCompleta = prod.url_imagen ? `${servidorUrl}${prod.url_imagen}` : null;
        const imgHtml = urlImagenCompleta 
            ? `<img src="${urlImagenCompleta}" alt="${prod.nombre_producto}" />` 
            : `<div class="sin-imagen">Sin Imagen</div>`;

        // Estructura HTML idéntica a la de tus categorías para mantener el diseño
        card.innerHTML = `
            <div class="imagen-contenedor">
                ${imgHtml}
            </div>
            <div class="info-contenedor">
                <p class="descripcion">${prod.descripcion || 'Sin descripción'}</p>
                <h3 class="titulo-producto">${prod.nombre_producto || 'Producto'}</h3>
                <p class="precio">$${parseFloat(prod.precio).toFixed(2)}</p>
            </div>
        `;
        contenedorResultados.appendChild(card);
    });
}