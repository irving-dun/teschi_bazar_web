document.addEventListener("DOMContentLoaded", () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- CONFIGURACIÓN DE URL ---
    // Usamos la variable de firebase-config.js
    const API_URL = API_BASE_URL; 

    let uidVendedor = null;
    let nombreVendedor = ""; 

    const iniciaSesionBoton = document.getElementById("iniciaSesionButton");
    const contenedorPerfilUsuario = document.getElementById("contenedorPerfilUsuario");
    const loadingStatus = document.getElementById("loadingStatus"); // Nuevo: para mostrar carga

    // === GESTIÓN DINÁMICA DE LA SESIÓN ===
    auth.onAuthStateChanged((usuario) => {
        if (usuario) {
            uidVendedor = usuario.uid;
            iniciaSesionBoton.style.display = "none";

            db.collection("usuarios").doc(usuario.uid).get().then((doc) => {
                const datosUsuarios = doc.exists ? doc.data() : {};
                nombreVendedor = datosUsuarios.nombre || usuario.email.split("@")[0];

                contenedorPerfilUsuario.innerHTML = `
                    <div class="perfil-dropdown">
                        <button class="btn-UsuarioNombre" id="dropdownUserButton">
                            Hola, ${nombreVendedor}
                        </button>
                        <div class="dropdown-content" id="userDropdownContent">
                            <a href="perfil.html">✏️ Mi Perfil</a>
                            <a href="publicarProducto.html">🛍️ Publicar</a>
                            <a href="#" onclick="window.logoutFirebase()">🚪 Cerrar Sesión</a>
                        </div>
                    </div>`;
                contenedorPerfilUsuario.style.display = "block";

                const dropdownButton = document.getElementById("dropdownUserButton");
                const dropdownContent = document.getElementById("userDropdownContent");

                dropdownButton.addEventListener("click", () => {
                    dropdownContent.classList.toggle("show");
                });
            });
        } else {
            window.location.href = "login.html";
        }
    });

    window.logoutFirebase = function () {
        auth.signOut().then(() => {
            window.location.href = "index.html";
        });
    };

    // === PREVISUALIZACIÓN DE IMÁGENES ===
    const inputArchivo = document.getElementById("imagenes");
    const areaCliqueable = document.getElementById("clicAreaMultimedia");
    const contenidoPorDefecto = document.getElementById("contenidoPorDefecto");
    const contenedorVistaPrevia = document.getElementById("contenedorVistaPrevia");

    if (areaCliqueable) {
        areaCliqueable.onclick = () => inputArchivo.click();
        inputArchivo.onchange = (e) => {
            contenedorVistaPrevia.innerHTML = "";
            const files = Array.from(e.target.files).slice(0, 3);
            if (files.length > 0) {
                contenidoPorDefecto.style.display = "none";
                contenedorVistaPrevia.style.display = "flex";
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = document.createElement("img");
                        img.src = ev.target.result;
                        img.style = "width:90px; height:90px; object-fit:cover; border-radius:10px; margin: 5px; border: 2px solid white;";
                        contenedorVistaPrevia.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
            }
        };
    }

    // === ENVÍO AL SERVIDOR ===
    const btnSubmit = document.getElementById("btnAccionPublicar");

    if (btnSubmit) {
        btnSubmit.onclick = async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!uidVendedor) return Swal.fire('Error', 'Cargando sesión...', 'info');

            // Validar que haya al menos una imagen
            if (inputArchivo.files.length === 0) {
                return Swal.fire('Atención', 'Por favor sube al menos una imagen del producto.', 'warning');
            }

            // UI: Desactivar botón y mostrar spinner/mensaje
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Subiendo...";
            if (loadingStatus) loadingStatus.style.display = "block";

            const formData = new FormData();
            formData.append('nombre_producto', document.getElementById("nombre_producto").value);
            formData.append('descripcion', document.getElementById("descripcion").value);
            formData.append('id_categoria', document.getElementById("categoria_id").value);
            formData.append('estado_producto', document.getElementById("estado").value);
            formData.append('disponibilidad', document.getElementById("disponibilidad").value);
            formData.append('precio', document.getElementById("precio").value);
            formData.append('ubicacion_entrega', document.getElementById("ubicacion_entrega").value);
            formData.append('id_usuario_vendedor', uidVendedor);
            formData.append('nombre_vendedor', nombreVendedor);

            const fotos = inputArchivo.files;
            for (let i = 0; i < fotos.length; i++) {
                formData.append('imagen', fotos[i]);
            }

            try {
                // CAMBIO: Usamos la constante API_URL que apunta a Render
                const response = await fetch(`${API_URL}/api/productos/insertar`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Error en el servidor al publicar');
                
                const resultado = await response.json();

                Swal.fire({
                    title: '¡Producto Publicado!',
                    text: 'Tu artículo ya está en TeschiBazar.',
                    icon: 'success',
                    confirmButtonText: 'Genial',
                    confirmButtonColor: '#28a745',
                    allowOutsideClick: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = "index.html";
                    }
                });

            } catch (error) {
                console.error("Error en la conexión:", error);
                Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
                
                // Resetear UI en caso de error
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Listar Producto Ahora";
                if (loadingStatus) loadingStatus.style.display = "none";
            }
        };
    }
});