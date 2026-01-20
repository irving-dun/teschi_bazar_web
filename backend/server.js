//------------ CONFIGURACIÓN DE DEPENDENCIAS Y MÓDULOS ------------
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// Configuración de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

//------------ CONFIGURACIÓN DE FIREBASE ------------
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
};

if (!admin.apps.length) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(firebaseConfig) });
        console.log("✅ Firebase listo");
    } catch (error) {
        console.error("❌ Error Firebase:", error.message);
    }
}

//------------ CONFIGURACIÓN DE MULTER (RAM) ------------
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

//------------ CONFIGURACIÓN DE BASE DE DATOS ------------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "tu_url_local_aqui",
    ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
    try {
        const client = await pool.connect();
        client.release();
        console.log('✅ PostgreSQL conectado');
    } catch (err) {
        console.error('❌ Error DB:', err.message);
        process.exit(1);
    }
}

//------------ RUTAS DE PRODUCTOS ------------

// Obtener todos (CON IMÁGENES) - Corregido
app.get('/api/productos', async (req, res) => {
    const sql = `
        SELECT p.*, i.url_imagen 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        ORDER BY p.fecha_publicacion DESC
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Detalle de producto
app.get('/api/productos/:id', async (req, res) => {
    const sql = `
        SELECT p.*, i.url_imagen, c.nombre_categoria 
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id_producto = i.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE p.id_producto = $1
    `;
    try {
        const result = await pool.query(sql, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No existe' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Insertar producto con imágenes a Cloudinary
app.post('/api/productos/insertar', upload.array('imagen', 3), async (req, res) => {
    const { nombre_producto, descripcion, id_categoria, estado_producto, disponibilidad, precio, id_usuario_vendedor, nombre_vendedor, ubicacion_entrega } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Asegurar que el usuario existe
        await client.query(
            `INSERT INTO usuarios (id_usuario, nombre) VALUES ($1, $2) ON CONFLICT (id_usuario) DO NOTHING`,
            [id_usuario_vendedor, nombre_vendedor || "Usuario"]
        );

        // 2. Insertar el producto (AJUSTADO A TU SCRIPT SQL)
        // 2. Insertar el producto (CORREGIDO: 8 columnas = 8 valores)
        const resProd = await client.query(
            `INSERT INTO productos (
        nombre_producto, 
        descripcion, 
        id_categoria, 
        estado_producto, 
        disponibilidad, 
        precio, 
        id_usuario_vendedor, 
        ubicacion_entrega
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_producto`,
            [
                nombre_producto,                             // $1
                descripcion,                                 // $2
                parseInt(id_categoria),                      // $3 (Aseguramos que sea número)
                estado_producto.toLowerCase().trim(),        // $4 (Forzamos minúsculas para el ENUM)
                parseInt(disponibilidad) || 1,               // $5 (Aseguramos que sea número)
                parseFloat(precio),                          // $6 (Aseguramos que sea decimal)
                id_usuario_vendedor,                         // $7
                ubicacion_entrega || 'No especificada'       // $8
            ]
        );
        // 2. Insertar el producto (CORREGIDO: 8 columnas = 8 valores)


        const id_producto = resProd.rows[0].id_producto;

        // 3. PROCESAR MULTIPLES IMAGENES (Cambio clave aquí)
        if (req.files && req.files.length > 0) {

            for (const file of req.files) {
                const uploadToCloudinary = () => {

                    return new Promise((resolve, reject) => {

                        const stream = cloudinary.uploader.upload_stream(
                            { folder: 'teschibazar_productos' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result.secure_url);
                            }
                        );
                        stream.end(file.buffer); // Ahora usa el buffer de cada archivo individual
                    });
                };

                const url_imagen = await uploadToCloudinary();

                // Guardar cada URL en la tabla de imágenes
                await client.query(
                    'INSERT INTO imagenes_producto (id_producto, url_imagen) VALUES ($1, $2)',
                    [id_producto, url_imagen]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, id: id_producto });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en servidor:", err.message); // Esto aparecerá en tus logs de Render
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

//------------ RUTAS DE PEDIDOS Y CITAS ------------

app.post('/api/pedidos/crear-peticion', async (req, res) => {
    const { id_comprador, id_producto, cantidad, total, metodo_pago, lugar_entrega } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const prod = await client.query('SELECT id_usuario_vendedor, precio, nombre_producto FROM productos WHERE id_producto = $1', [id_producto]);
        const { id_usuario_vendedor, precio, nombre_producto } = prod.rows[0];

        const resPed = await client.query(
            `INSERT INTO pedidos (id_comprador, id_vendedor, total_pedido, estado_pedido, metodo_pago, lugar_entrega) 
             VALUES ($1, $2, $3, 'pendiente', $4, $5) RETURNING id_pedido`,
            [id_comprador, id_usuario_vendedor, total, metodo_pago, lugar_entrega]
        );
        const id_pedido = resPed.rows[0].id_pedido;

        await client.query(`INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)`, [id_pedido, id_producto, cantidad || 1, precio]);

        const mensajeV = `¡Nueva petición! Quieren comprar tu ${nombre_producto}.`;
        await client.query('INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje) VALUES ($1, $2, $3)', [id_usuario_vendedor, 'nuevo_pedido', mensajeV]);

        await client.query('COMMIT');
        io.emit(`notificacion_${id_usuario_vendedor}`, { mensaje: mensajeV, id_pedido });
        res.status(201).json({ success: true, id_pedido });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

app.put('/api/pedidos/confirmar-cita', async (req, res) => {
    const { id_pedido, fecha, hora, lugar } = req.body;
    try {
        const det = await pool.query(`SELECT p.id_comprador, pr.nombre_producto FROM pedidos p JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido JOIN productos pr ON dp.id_producto = pr.id_producto WHERE p.id_pedido = $1`, [id_pedido]);
        const { id_comprador, nombre_producto } = det.rows[0];

        await pool.query(`UPDATE pedidos SET fecha_entrega=$1, hora_entrega=$2, lugar_entrega=$3, estado_pedido='confirmado' WHERE id_pedido=$4`, [fecha, hora, lugar, id_pedido]);

        const mensajeC = `¡Cita agendada! Tu "${nombre_producto}" se entrega el ${fecha} a las ${hora} en ${lugar}.`;
        await pool.query('INSERT INTO notificaciones (id_usuario, tipo_notificacion, mensaje) VALUES ($1, $2, $3)', [id_comprador, 'cita_confirmada', mensajeC]);

        io.emit(`notificacion_${id_comprador}`, { mensaje: mensajeC, id_pedido });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Finalizar pedido y descontar stock
app.put('/api/pedidos/finalizar/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const detalle = await client.query('SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = $1', [req.params.id]);
        for (const fila of detalle.rows) {
            await client.query('UPDATE productos SET disponibilidad = disponibilidad - $1 WHERE id_producto = $2', [fila.cantidad, fila.id_producto]);
        }
        await client.query("UPDATE pedidos SET estado_pedido = 'entregado' WHERE id_pedido = $1", [req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
    finally { client.release(); }
});

//------------ OTRAS RUTAS ------------

app.get('/api/notificaciones/:idUsuario', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notificaciones WHERE id_usuario = $1 ORDER BY fecha_creacion DESC LIMIT 10', [req.params.idUsuario]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/productos-destacados', async (req, res) => {
    const sql = `
        SELECT p.id_producto, p.nombre_producto, p.precio, i.url_imagen, COUNT(ped.id_pedido) as ventas 
        FROM productos p
        JOIN imagenes_producto i ON p.id_producto = i.id_producto
        JOIN detalle_pedido dp ON p.id_producto = dp.id_producto
        JOIN pedidos ped ON dp.id_pedido = ped.id_pedido
        WHERE ped.estado_pedido = 'entregado' 
        GROUP BY p.id_producto, i.url_imagen ORDER BY ventas DESC LIMIT 12`;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

//------------ SERVIDOR Y SOCKETS ------------
const io = new Server(server, { cors: { origin: "*" } });

initializeDatabase().then(() => {
    server.listen(port, () => console.log(`🚀 Servidor en puerto ${port}`));
});