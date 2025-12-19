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
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
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
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
console.log('✅ Firebase Admin SDK inicializado.');

// =======================================================
// CONFIGURACIÓN DE MULTER (PROCESAMIENTO DE IMÁGENES)
// =======================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL)
// =======================================================
const DATABASE_URL_LOCAL = "postgresql://irving:4jsZSjNG0ZaqCNw7zQQlvGjt7ibkbUMn@dpg-d4vnjfhr0fns739p88l0-a.virginia-postgres.render.com/teschibazar"; 

const dbConfig = {
    connectionString: process.env.DATABASE_URL || DATABASE_URL_LOCAL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, 
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

// =================================================================
// RUTAS DE LA API
// =================================================================

// 🔍 RUTA: Obtener detalle de producto
app.get('/api/productos/:id', async (req, res) => {
    const idProducto = req.params.id;
    const sql = `
        SELECT p.*, i.url_imagen, c.nombre_categoria 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1
    `;
    try {
        const result = await pool.query(sql, [idProducto]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No existe' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📤 RUTA: Insertar nuevo producto
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
    // 1. Agregamos un log para ver en la terminal que los datos llegaron
    console.log("📥 Recibiendo producto:", req.body.nombre_producto);

    const { 
        nombre_producto, descripcion, id_categoria, 
        estado_producto, disponibilidad, precio, 
        id_usuario_vendedor, nombre_vendedor, ubicacion_entrega 
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Registro de usuario (ON CONFLICT evita errores si ya existe)
        await client.query(
            `INSERT INTO usuarios (id_usuario, nombre) 
             VALUES ($1, $2) ON CONFLICT (id_usuario) DO NOTHING`, 
            [id_usuario_vendedor, nombre_vendedor || "Usuario"]
        );

        // Registro del producto
        const resProd = await client.query(
            `INSERT INTO productos (nombre_producto, descripcion, id_categoria, estado_producto, disponibilidad, precio, id_usuario_vendedor, ubicacion_entrega) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_producto`,
            [nombre_producto, descripcion, id_categoria, estado_producto, disponibilidad, precio, id_usuario_vendedor, ubicacion_entrega]
        );

        const id_producto = resProd.rows[0].id_producto;

        // Registro de la imagen (si existe)
        if (req.file) {
            await client.query('INSERT INTO imagenes_producto (id_producto, url_imagen) VALUES ($1, $2)', 
                [id_producto, `/uploads/${req.file.filename}`]
            );
        }

        await client.query('COMMIT');
        
        // 2. Respuesta ultra-clara para el frontend
        console.log("✅ Producto guardado con éxito:", id_producto);
        return res.status(200).json({ success: true, mensaje: "¡Éxito!", id: id_producto });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Error en el servidor:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        if (client) client.release();
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

// 📚 RUTA: Obtener todos los productos (CORRECCIÓN VITAL AQUÍ)
app.get('/api/productos', async (req, res) => {
    // ELIMINADO EL req.body QUE ROMPÍA LA CARGA
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

initializeDatabase().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Servidor en puerto ${port}`);
    });
});