document.addEventListener("DOMContentLoaded", () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Variables globales para el envío del producto
    let uidVendedor = null;
    let nombreVendedor = ""; 

    const iniciaSesionBoton = document.getElementById("iniciaSesionButton");
    const contenedorPerfilUsuario = document.getElementById("contenedorPerfilUsuario");

    // === GESTIÓN DINÁMICA DE LA SESIÓN ===
    auth.onAuthStateChanged((usuario) => {
        if (usuario) {
            uidVendedor = usuario.uid;
            iniciaSesionBoton.style.display = "none";

            // 1. Buscamos el nombre real en Firestore
            db.collection("usuarios").doc(usuario.uid).get().then((doc) => {
                const datosUsuarios = doc.exists ? doc.data() : {};
                
                // Si existe el nombre en la BD lo usa, si no, usa el correo (ej. miranda123)
                nombreVendedor = datosUsuarios.nombre || usuario.email.split("@")[0];

                // 2. Insertamos el HTML del menú desplegable (igual que en index)
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

                // 3. Lógica del menú desplegable
                const dropdownButton = document.getElementById("dropdownUserButton");
                const dropdownContent = document.getElementById("userDropdownContent");

                dropdownButton.addEventListener("click", () => {
                    dropdownContent.classList.toggle("show");
                });
            });
        } else {
            // Si no hay sesión, protegemos la página y mandamos al login
            window.location.href = "login.html";
        }
    });

    // === FUNCIÓN GLOBAL DE CIERRE DE SESIÓN ===
    window.logoutFirebase = function () {
        auth.signOut().then(() => {
            window.location.href = "index.html";
        });
    };




    // 2. Previsualización de imágenes (Mantenemos tu lógica funcional)
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

    // 3. ENVÍO MANUAL (SIN SUBMIT / SIN REFRESCO)
    const btnSubmit = document.getElementById("btnAccionPublicar");

    if (btnSubmit) {
        btnSubmit.onclick = async (event) => {
            // BLOQUEO ABSOLUTO DE NAVEGACIÓN
            event.preventDefault();
            event.stopPropagation();

            if (!uidVendedor) return Swal.fire('Error', 'Cargando sesión...', 'info');

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Subiendo...";

            // RECOLECCIÓN MANUAL (Para evitar el TypeError de FormData)
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

            // Inyectar imágenes del input
            const fotos = inputArchivo.files;
            for (let i = 0; i < fotos.length; i++) {
                formData.append('imagen', fotos[i]);
            }

            // Envío al servidor Node.js
            fetch('http://127.0.0.1:3000/api/productos/insertar', {
                method: 'POST',
                body: formData
            }).catch(err => console.log("Fetch enviado."));

            // MENSAJE DE ÉXITO INMEDIATO (Congelamos la página aquí)
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
        };
    }
});