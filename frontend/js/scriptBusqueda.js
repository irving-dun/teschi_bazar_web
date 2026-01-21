const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
const contenedorResultados = document.getElementById('contenedor-productos') || document.querySelector('.productos-grid');

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

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounceTimeout);
    ejecutarBusqueda(searchInput.value.trim());
});

async function ejecutarBusqueda(query) {
    if (query.length < 2) return;

    try {
        // CAMBIO: Usamos API_BASE_URL para que la búsqueda consulte al servidor en la nube
        const response = await fetch(`${API_BASE_URL}/api/buscar?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Error en el servidor");
        
        const productos = await response.json();
        renderizarInterfazFusionada(productos, query);

    } catch (error) {
        console.error("Error al buscar:", error);
    }
}

function renderizarInterfazFusionada(productos, termino) {
    if (!contenedorResultados) return;
    contenedorResultados.innerHTML = ''; 

    if (productos.length === 0) {
        contenedorResultados.innerHTML = `<h3 class="no-results">No se encontraron resultados para "${termino}"</h3>`;
        return;
    }

    productos.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'producto-card'; 
        card.style.cursor = 'pointer';
        card.onclick = () => {
            window.location.href = `detalleProducto.html?id=${prod.id_producto}`;
        };

        // CAMBIO: Aseguramos que el placeholder apunte correctamente según tu estructura /html /js
        let urlImagenFinal = '../img/placeholder.png'; 
        
        if (prod.url_imagen) {
            // CAMBIO: Si no es Cloudinary (http), concatenamos con API_BASE_URL de Render
            urlImagenFinal = prod.url_imagen.startsWith('http') 
                ? prod.url_imagen 
                : `${API_BASE_URL}${prod.url_imagen}`;
        }

        card.innerHTML = `
            <div class="imagen-contenedor">
                <img src="${urlImagenFinal}" alt="${prod.nombre_producto}" onerror="this.src='../img/placeholder.png'" />
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