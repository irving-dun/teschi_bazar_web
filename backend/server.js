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
// Ruta estática para servir las imágenes subidas
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Ruta estática para servir el frontend
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));


// =======================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK
// =======================================================

const serviceAccount = require('./adminsdk.json'); 

admin.initializeApp({
 credential: admin.credential.cert(serviceAccount)
});
console.log('✅ Firebase Admin SDK inicializado.');

// =======================================================
// UTILIDADES DE SEGURIDAD
// =======================================================

async function verificarTokenFirebase(idToken) {
 try {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
 } catch (error) {
  console.error('Error al verificar el token de Firebase:', error.message);
  throw new Error("Token de autenticación inválido o expirado.");
 }
}


// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL para Render)
// =======================================================

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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

// --- Configuración de MULTER (Carga de Imágenes) ---
const storage = multer.diskStorage({
 destination: (req, file, cb) => {
  cb(null, path.join(__dirname, 'uploads')); 
 },
 filename: (req, file, cb) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
 }
});
const upload = multer({ storage: storage });

// =================================================================
// UTILIDADES DE CHAT (PERSISTENCIA PostgreSQL)
// =================================================================

// Obtiene el vendedor de un producto
async function obtenerVendedor(idProducto) {
  const result = await pool.query(
    'SELECT id_usuario_vendedor FROM productos WHERE id_producto = $1',
    [idProducto]
  );
  if (result.rows.length === 0) throw new Error("Producto no encontrado.");
  return result.rows[0].id_usuario_vendedor;
}

// Obtiene o crea la conversación
async function obtenerOCrearConversacion(compradorId, vendedorId, productoId) {
  let result = await pool.query(
    `SELECT id_conversacion FROM conversaciones 
    WHERE id_comprador = $1 AND id_vendedor = $2 AND id_producto = $3`,
    [compradorId, vendedorId, productoId]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id_conversacion;
  }

  const newResult = await pool.query(
    `INSERT INTO conversaciones (id_comprador, id_vendedor, id_producto) 
    VALUES ($1, $2, $3) RETURNING id_conversacion`,
    [compradorId, vendedorId, productoId]
  );
  return newResult.rows[0].id_conversacion;
}

// Guarda el mensaje y actualiza el timestamp (usa transacción)
async function guardarMensaje(conversacionId, remitenteId, contenido) {
  const client = await pool.connect(); 
  let nuevoMensaje = null;
  
  try {
    await client.query('BEGIN'); 

    const msgResult = await client.query(
      `INSERT INTO mensajes (id_conversacion, id_remitente, contenido) 
      VALUES ($1, $2, $3) RETURNING id_mensaje, fecha_envio`,
      [conversacionId, remitenteId, contenido]
    );
    
    await client.query(
      'UPDATE conversaciones SET ultimo_mensaje_at = CURRENT_TIMESTAMP WHERE id_conversacion = $1',
      [conversacionId]
    );

    await client.query('COMMIT'); 

    nuevoMensaje = { 
      id_mensaje: msgResult.rows[0].id_mensaje,
      id_conversacion: conversacionId,
      id_remitente: remitenteId,
      contenido: contenido,
      fecha_envio: msgResult.rows[0].fecha_envio
    };
    
    return nuevoMensaje;
    
  } catch (error) {
    await client.query('ROLLBACK'); 
    throw error; 
  } finally {
    client.release(); 
  }
}

// Obtiene el historial de mensajes para una conversación dada
async function obtenerMensajesPorConversacion(conversacionId) {
  const sql = `
 SELECT 
      id_mensaje, 
      id_remitente, 
      contenido, 
      fecha_envio,
      leido
    FROM mensajes
    WHERE id_conversacion = $1
    ORDER BY fecha_envio ASC;
  `;
  
  try {
    const result = await pool.query(sql, [conversacionId]);
    return result.rows;
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    throw new Error('No se pudo cargar el historial de mensajes.');
  }
}


// =================================================================
// RUTAS DE LA API (ADAPTADO A POSTGRESQL)
// =================================================================

// 🚀 RUTA 1: POST - Insertar un nuevo producto con imagen
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
 const { id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado_producto } = req.body;
 const imagen_url = req.file ? '/uploads/' + req.file.filename : null; 

 if (!id_usuario_vendedor || !nombre_producto || !precio || !imagen_url) {
  return res.status(400).json({ mensaje: 'Faltan datos requeridos (incluyendo la imagen).' });
 }

 const sql = "INSERT INTO productos (id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado_producto, imagen_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_producto";
 
 try {
  const result = await pool.query(sql, [id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado_producto, imagen_url]);
  
  res.status(201).json({ 
   mensaje: 'Producto insertado con éxito', 
   id_producto: result.rows[0].id_producto,
   ruta_imagen: imagen_url
  });
 } catch (err) {
  console.error('Error al insertar producto:', err);
  if (req.file) {
   fs.unlinkSync(req.file.path); 
  }
  res.status(500).json({ error: 'Error interno del servidor al insertar producto.' });
 }
});

// 📚 RUTA 2: GET - Obtener todos los productos
app.get('/api/productos', async (req, res) => {
 const sql = "SELECT * FROM productos";
 
 try {
  const result = await pool.query(sql); 
  res.json(result.rows); 
 } catch (err) {
  console.error('Error al consultar productos:', err);
  res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
 }
});

// 📦 RUTA NUEVA: GET - Obtener productos por ID de Categoría (PARA EL FRONTEND)
app.get('/api/productos/categoria/:categoriaId', async (req, res) => {
 const categoriaId = req.params.categoriaId; 
 
 const idNumerico = parseInt(categoriaId);
 if (isNaN(idNumerico)) {
   return res.status(400).json({ error: 'ID de categoría inválido.' });
 }

 // Consulta optimizada para el frontend
 const sql = `
    SELECT 
        id_producto, 
        nombre_producto, 
        descripcion, 
        precio, 
        imagen_url 
    FROM productos 
    WHERE categoria_id = $1
`;
 
 try {
   const result = await pool.query(sql, [idNumerico]); 
   res.json(result.rows); 
 } catch (err) {
   console.error('Error al consultar productos por categoría:', err);
   res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
 }
});


// 💬 RUTA 4: GET - Obtener historial de mensajes de una conversación (La antigua RUTA 3)
app.get('/api/chat/:idConversacion', async (req, res) => {
  const idConversacion = parseInt(req.params.idConversacion);

  if (isNaN(idConversacion)) {
    return res.status(400).json({ error: 'El ID de la conversación debe ser un número válido.' });
  }

  try {
    // Mejorar: Añadir verificación de que el usuario que solicita es parte de la conversación
    const mensajes = await obtenerMensajesPorConversacion(idConversacion);
    
    res.json(mensajes);
  } catch (err) {
    console.error('Error al obtener historial de chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// =======================================================
// INICIAR SERVIDOR HTTP Y WEBSOCKETS (CHAT)
// =======================================================
const server = http.createServer(app); 

// Montar Socket.IO sobre el servidor HTTP
const io = new Server(server, {
 cors: {
  origin: "*",
  methods: ["GET", "POST"]
 }
});

const usuariosConectados = {}; 

// --- LÓGICA DE WEBSOCKETS (SOCKET.IO) ---
io.on('connection', (socket) => {
 console.log(`Un socket se ha conectado: ${socket.id}`);

 // 1. REGISTRO SEGURO (Usa el token para registrar el socket)
 socket.on('client:registrar_usuario', async ({ idToken, userId }) => {
  try {
   const uidVerificado = await verificarTokenFirebase(idToken);
   
   if (uidVerificado !== userId) {
    throw new Error("UID de token no coincide con el ID del usuario.");
   }

   usuariosConectados[uidVerificado] = socket.id;
   console.log(`✅ Usuario ${uidVerificado} registrado y verificado.`);

  } catch (error) {
   console.error(`❌ Fallo en registro de socket: ${error.message}`);
   socket.emit('server:auth_error', 'Autenticación fallida. Reconecte.');
   socket.disconnect(true);
  }
 });
 
 // 2. EL SUJETO/OBSERVABLE (El corazón del chat)
 socket.on('client:enviar_mensaje', async (data) => {
  try {
   const { idToken, remitenteId, productoId, contenido } = data; 
   
   // 2.1. SEGURIDAD: Re-verificar el remitente
   const uidVerificado = await verificarTokenFirebase(idToken);
   if (uidVerificado !== remitenteId) {
    throw new Error("Acceso denegado: Remitente falsificado.");
   }

   // 2.2. PERSISTENCIA: Guardar en PostgreSQL
   const vendedorId = await obtenerVendedor(productoId); 
   
   const mensajeGuardado = await guardarMensaje(
    await obtenerOCrearConversacion(remitenteId, vendedorId, productoId), 
    remitenteId, 
    contenido
   ); 

   // 2.3. NOTIFICACIÓN: A los Observadores (Vendedor y Comprador)
   const receptores = [vendedorId, remitenteId];
   
   receptores.forEach(userId => {
    const socketId = usuariosConectados[userId];
    if (socketId) {
     io.to(socketId).emit('server:nuevo_mensaje', mensajeGuardado);
    }
   });

  } catch (error) {
   console.error('Error en el Sujeto/Envío de mensaje:', error.message);
   socket.emit('server:error_mensaje', { error: 'No se pudo enviar el mensaje.' });
  }
 });

 // Lógica de desconexión
 socket.on('disconnect', () => {
  for (const userId in usuariosConectados) {
   if (usuariosConectados[userId] === socket.id) {
    delete usuariosConectados[userId];
    break;
   }
  }
  console.log(`Usuario desconectado: ${socket.id}`);
 });
});
// ------------------------------------------

// Inicializa la base de datos (pool) y luego inicia el servidor combinado (HTTP/Socket.IO)
initializeDatabase().then(() => {
 server.listen(port, () => {
  console.log(`Servidor Express/Socket.IO corriendo en http://localhost:${port}`);
 });
});