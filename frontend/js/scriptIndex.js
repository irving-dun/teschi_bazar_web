document.addEventListener("DOMContentLoaded", () => {
    // --- CONFIGURACIÓN DE URL ---
    const servidorUrl = "https://teschi-bazar-web.onrender.com";

    const btnLogin = document.getElementById("iniciaSesionButton");
    const divUser = document.getElementById("contenedorPerfilUsuario");

    if (!btnLogin || !divUser) return;

    // --- 1. LÓGICA DE CARGA INSTANTÁNEA (Caché) ---
    const nombreCache = localStorage.getItem("usuario_nombre");
    if (nombreCache) {
        mostrarMenuUsuario(nombreCache);
        btnLogin.style.display = "none"; 
    } else {
        btnLogin.style.display = "inline-flex";
    }

    // --- 2. VERIFICACIÓN REAL CON FIREBASE ---
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            db.collection("usuarios").doc(user.uid).get().then((doc) => {
                const nombreReal = doc.exists ? (doc.data().nombre || user.email.split("@")[0]) : user.email.split("@")[0];
                if (localStorage.getItem("usuario_nombre") !== nombreReal) {
                    localStorage.setItem("usuario_nombre", nombreReal);
                    mostrarMenuUsuario(nombreReal);
                }
            });
        } else {
            localStorage.removeItem("usuario_nombre");
            btnLogin.style.display = "inline-flex";
            divUser.style.display = "none";
            divUser.innerHTML = "";
        }
    });

    function mostrarMenuUsuario(nombre) {
        divUser.innerHTML = `
            <div class="perfil-dropdown">
                <button class="btn-UsuarioNombre" id="dropdownUserButton">
                    Hola, ${nombre}
                </button>
                <div class="dropdown-content" id="userDropdownContent">
                    <a href="perfil.html">✏️ Mi Perfil</a>
                    <a href="publicarProducto.html">🛍️ Publicar</a>
                    <a href="#" id="logoutLink">🚪 Cerrar Sesión</a>
                </div>
            </div>`;
        divUser.style.display = "block";
        btnLogin.style.display = "none";
    }

    // --- 3. MANEJO DE CLICS ---
    document.addEventListener("click", (e) => {
        const dropdownContent = document.getElementById("userDropdownContent");
        if (e.target.closest("#dropdownUserButton")) {
            e.preventDefault();
            if (dropdownContent) dropdownContent.classList.toggle("show");
        } 
        else if (e.target.closest("#logoutLink")) {
            e.preventDefault();
            window.logoutFirebase();
        }
        else {
            if (dropdownContent && dropdownContent.classList.contains("show")) {
                dropdownContent.classList.remove("show");
            }
        }
    });
});

// Logout Global
window.logoutFirebase = function() {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem("usuario_nombre");
        window.location.href = "index.html";
    }).catch(error => console.error("Error al cerrar sesión:", error));
};

// --- 4. CARGA DE PRODUCTOS DESDE RENDER ---
async function cargarDestacadosDesdeDB() {
    // CAMBIO: URL de Render
    const servidorUrl = "https://teschi-bazar-web.onrender.com";
    const contenedor = document.getElementById("contenedorProductosDestacados");
    
    if (!contenedor) return;

    try {
        const respuesta = await fetch(`${servidorUrl}/api/productos-destacados`);
        const productos = await respuesta.json();

        if (productos.length === 0) {
            contenedor.innerHTML = "<p>Aún no hay productos destacados.</p>";
            return;
        }

        contenedor.innerHTML = "";

        productos.forEach(prod => {
            const card = document.createElement("div");
            card.className = "producto-card";
            card.setAttribute("data-id", prod.id_producto);
            card.style.cursor = "pointer";

            const etiquetaVentas = prod.ventas > 0 
                ? `<div class="etiqueta-ventas"><span>🔥 ${prod.ventas} vendidos</span></div>` 
                : "";

            // --- IMPORTANTE: LÓGICA DE IMÁGENES ---
            // Si la imagen ya es una URL de Cloudinary (empieza con http), la usamos directo.
            // Si es una ruta relativa, le pegamos el servidorUrl.
            let urlImagenFinal = '/frontend/img/placeholder.png';
            if (prod.url_imagen) {
                urlImagenFinal = prod.url_imagen.startsWith('http') 
                    ? prod.url_imagen 
                    : servidorUrl + prod.url_imagen;
            }

            card.innerHTML = `
                <div class="imagen-contenedor">
                    <img src="${urlImagenFinal}" alt="${prod.nombre_producto}" />
                </div>
                <div class="info-contenedor">
                    ${etiquetaVentas}
                    <p class="descripcion">${prod.descripcion || 'Sin descripción'}</p>
                    <h3 class="titulo-producto">${prod.nombre_producto}</h3>
                    <p class="precio">$${parseFloat(prod.precio).toFixed(2)}</p>
                </div>
            `;
            contenedor.appendChild(card);
        });

        // Delegación de eventos para el clic
        contenedor.onclick = (e) => {
            const card = e.target.closest(".producto-card");
            if (card) {
                const id = card.getAttribute("data-id");
                if (id) window.location.href = `detalleProducto.html?id=${id}`;
            }
        };

    } catch (error) {
        console.error("Error cargando productos:", error);
        contenedor.innerHTML = "<p>Error al conectar con el servidor.</p>";
    }
}

// Ejecutar carga al iniciar
document.addEventListener("DOMContentLoaded", cargarDestacadosDesdeDB);