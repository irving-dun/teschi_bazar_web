async function cargarNotificaciones(idUsuario) {
    const response = await fetch(`http://localhost:3000/api/notificaciones/${idUsuario}`);
    const notificaciones = await response.json();
    
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    
    list.innerHTML = "";
    let sinLeer = 0;

    notificaciones.forEach(n => {
        if (!n.leida) sinLeer++; // Usando tu columna 'leida'
        
        const item = document.createElement('div');
        item.className = `notif-item ${n.leida ? 'leida' : 'nueva'}`;
        item.innerHTML = `
            <p class="notif-msg">${n.mensaje}</p>
            <span class="notif-tipo">${n.tipo_notificacion}</span>
        `;
        item.onclick = () => window.location.href = n.url_destino;
        list.appendChild(item);
    });

    if (sinLeer > 0) {
        badge.innerText = sinLeer;
        badge.classList.remove('hidden');
    }
}

const bellBtn = document.getElementById('bell-button');
const notifDropdown = document.getElementById('notif-dropdown');

bellBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Evita que se cierre inmediatamente
    notifDropdown.classList.toggle('hidden');
    
    // Al abrir, podrías marcar todas como leídas en la base de datos
});

// Cerrar si se hace clic fuera del menú
document.addEventListener('click', () => {
    notifDropdown.classList.add('hidden');
});