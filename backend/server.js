// =======================================================
// CONFIGURACIÓN DE DEPENDENCIAS Y MÓDULOS
// =======================================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const fs = require('fs'); 

const app = express();
const port = process.env.PORT || 3000; 

// Middleware
app.use(cors());
app.use(express.json());

// --- Configuración de RUTAS DE ARCHIVOS ---
const UPLOADS_DIR = path.join(__dirname, '..', 'sandbox', 'uploads'); 
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// =======================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK
// =======================================================
const serviceAccount = require('./adminsdk.json'); 
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
console.log('✅ Firebase Admin SDK inicializado.');

// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL)
// =======================================================
const DATABASE_URL_LOCAL = "postgresql://irving:4jsZSjNG0ZaqCNw7zQQlvGjt7ibkbUMn@dpg-d4vnjfhr0fns739p88l0-a.virginia-postgres.render.com/teschibazar"; 

const dbConfig = {
    connectionString: process.env.DATABASE_URL || DATABASE_URL_LOCAL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000, 
    idleTimeoutMillis: 30000
};

let pool; 
async function initializeDatabase() {
    try {
        pool = new Pool(dbConfig); 
        const client = await pool.connect();
        client.release(); 
        console.log('✅ Conexión a PostgreSQL exitosa!');
    } catch (err) {
        console.error('❌ Error al conectar con PostgreSQL:', err.message);
        process.exit(1); 
    }
}

// =======================================================
// UTILIDADES (CHAT Y SEGURIDAD)
// =======================================================
async function verificarTokenFirebase(idToken) {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        throw new Error("Token inválido.");
    }
}

async function obtenerVendedor(idProducto) {
    const result = await pool.query('SELECT id_usuario_vendedor FROM productos WHERE id_producto = $1', [idProducto]);
    if (result.rows.length === 0) throw new Error("Producto no encontrado.");
    return result.rows[0].id_usuario_vendedor;
}

// (Omití por brevedad guardarMensaje y obtenerOCrearConversacion para enfocarme en las rutas, pero mantenlas en tu archivo real)

// =================================================================
// RUTAS DE LA API
// =================================================================

// 🔍 RUTA: Obtener detalle de producto (Corregida para traer TODO, incluyendo fecha)
app.get('/api/productos/:id', async (req, res) => {
    const idProducto = req.params.id;
    const sql = `
        SELECT 
            p.*, 
            i.url_imagen, 
            c.nombre_categoria 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1
    `;
    
    try {
        const result = await pool.query(sql, [idProducto]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No existe' });
        res.json(result.rows[0]); // Aquí va el campo fecha_publicacion
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🛒 RUTA: Obtener productos por categoría
app.get('/api/productos/categoria/:id', async (req, res) => {
    const idCategoria = req.params.id;
    const sql = `
        SELECT p.*, i.url_imagen 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        WHERE p.id_categoria = $1
        ORDER BY p.fecha_publicacion DESC
    `;
    try {
        const result = await pool.query(sql, [idCategoria]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al filtrar.' });
    }
});

// 📚 RUTA: Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    const sql = "SELECT * FROM productos ORDER BY fecha_publicacion DESC";
    try {
        const result = await pool.query(sql); 
        res.json(result.rows); 
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener datos.' });
    }
});

// =======================================================
// SERVIDOR Y SOCKET.IO
// =======================================================
const server = http.createServer(app); 
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

io.on('connection', (socket) => {
    // ... Tu lógica de Socket.io (registrar_usuario, enviar_mensaje, etc.)
});

initializeDatabase().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Servidor en puerto ${port}`);
    });
});