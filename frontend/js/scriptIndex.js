document.addEventListener("DOMContentLoaded", () => {
    const btnLogin = document.getElementById("iniciaSesionButton");
    const divUser = document.getElementById("contenedorPerfilUsuario");

    if (!btnLogin || !divUser) return;

    // --- 1. LÓGICA DE CARGA INSTANTÁNEA ---
    const nombreCache = localStorage.getItem("usuario_nombre");
    
    // Si hay caché, mostramos el menú de inmediato y nos aseguramos que el login esté oculto
    if (nombreCache) {
        mostrarMenuUsuario(nombreCache);
        btnLogin.style.display = "none"; 
    } else {
        // Si no hay caché, mostramos login, pero solo si Firebase no dice lo contrario luego
        btnLogin.style.display = "inline-flex";
    }

    // --- 2. VERIFICACIÓN REAL CON FIREBASE ---
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            db.collection("usuarios").doc(user.uid).get().then((doc) => {
                const nombreReal = doc.exists ? (doc.data().nombre || user.email.split("@")[0]) : user.email.split("@")[0];
                
                // Solo actualizamos el DOM si el nombre cambió o no había caché
                if (localStorage.getItem("usuario_nombre") !== nombreReal) {
                    localStorage.setItem("usuario_nombre", nombreReal);
                    mostrarMenuUsuario(nombreReal);
                }
            });
        } else {
            // Limpieza total si no hay usuario
            localStorage.removeItem("usuario_nombre");
            btnLogin.style.display = "inline-flex";
            divUser.style.display = "none";
            divUser.innerHTML = "";
        }
    });

    // --- 3. FUNCIÓN PARA DIBUJAR EL MENÚ ---
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

    // --- 4. MANEJO DE CLICS ---
    document.addEventListener("click", (e) => {
        const dropdownContent = document.getElementById("userDropdownContent");
        
        // Botón de Usuario
        if (e.target.closest("#dropdownUserButton")) {
            e.preventDefault();
            if (dropdownContent) dropdownContent.classList.toggle("show");
        } 
        // Cerrar Sesión
        else if (e.target.closest("#logoutLink")) {
            e.preventDefault();
            window.logoutFirebase();
        }
        // Cerrar al hacer clic fuera
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
async function cargarDestacadosDesdeDB() {
    const servidorUrl = "http://localhost:3000";
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
            
            // Guardamos el ID en un atributo personalizado
            card.setAttribute("data-id", prod.id_producto);
            card.style.cursor = "pointer";

            const etiquetaVentas = prod.ventas > 0 
                ? `<div class="etiqueta-ventas"><span>🔥 ${prod.ventas} vendidos</span></div>` 
                : "";

            card.innerHTML = `
                <div class="imagen-contenedor">
                    <img src="${prod.url_imagen ? servidorUrl + prod.url_imagen : '/frontend/img/placeholder.png'}" alt="${prod.nombre_producto}" />
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

        // --- SOLUCIÓN AL CLIC: Delegación de eventos ---
        contenedor.addEventListener("click", (e) => {
            // Buscamos la tarjeta (card) más cercana al lugar donde se hizo clic
            const card = e.target.closest(".producto-card");
            if (card) {
                const id = card.getAttribute("data-id");
                if (id) {
                    window.location.href = `detalleProducto.html?id=${id}`;
                }
            }
        });

    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

// Asegúrate de que esto se ejecute al cargar el DOM
document.addEventListener("DOMContentLoaded", cargarDestacadosDesdeDB);

// Iniciar la carga cuando la página esté lista
document.addEventListener("DOMContentLoaded", cargarDestacadosDesdeDB);