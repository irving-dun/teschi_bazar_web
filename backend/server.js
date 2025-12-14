// =======================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK
// =======================================================
const admin = require('firebase-admin');

// ¡IMPORTANTE! Reemplaza con la ruta correcta de tu clave de servicio
const serviceAccount = require('./adminsdk.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
console.log(' Firebase Admin SDK inicializado.');

// =======================================================
// UTILIDADES DE SEGURIDAD (AÑADIDO)
// =======================================================

/**
 * Verifica el token de Firebase y devuelve el UID del usuario verificado.
 * @param {string} idToken El token JWT enviado desde el cliente.
 * @returns {Promise<string>} El UID del usuario si es válido.
 */
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
// CONFIGURACIÓN DE DEPENDENCIAS Y SERVIDOR EXPRESS
// =======================================================
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS
// =======================================================
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'teschibazar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool; 

async function initializeDatabase() {
  try {
    pool = await mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    connection.release();
    console.log('✅ Conexión a MySQL exitosa!');
  } catch (err) {
    console.error('❌ Error al conectar con MySQL:', err.message);
    process.exit(1);
  }
}

// --- Configuración de MULTER (Carga de Imágenes) ---
// (Mantenido sin cambios)
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
// UTILIDADES DE CHAT (MySQL PERSISTENCIA) (AÑADIDO)
// =================================================================

// Obtiene el vendedor de un producto
async function obtenerVendedor(idProducto) {
  const [rows] = await pool.execute(
    'SELECT id_usuario_vendedor FROM productos WHERE id_producto = ?',
    [idProducto]
  );
  if (rows.length === 0) throw new Error("Producto no encontrado.");
  return rows[0].id_usuario_vendedor;
}

// Obtiene o crea la conversación
async function obtenerOCrearConversacion(compradorId, vendedorId, productoId) {
  // 1. Buscar conversación existente
  let [rows] = await pool.execute(
    `SELECT id_conversacion FROM conversaciones 
    WHERE id_comprador = ? AND id_vendedor = ? AND id_producto = ?`,
    [compradorId, vendedorId, productoId]
  );

  if (rows.length > 0) {
    return rows[0].id_conversacion;
  }

  // 2. Si no existe, crear nueva conversación
  const [result] = await pool.execute(
    `INSERT INTO conversaciones (id_comprador, id_vendedor, id_producto) 
    VALUES (?, ?, ?)`,
    [compradorId, vendedorId, productoId]
  );
  return result.insertId;
}

// Guarda el mensaje y actualiza el timestamp
async function guardarMensaje(conversacionId, remitenteId, contenido) {
  const connection = await pool.getConnection();
  let nuevoMensaje = null;
  
  try {
    await connection.beginTransaction();

    // 1. Insertar el mensaje
    const [msgResult] = await connection.execute(
      `INSERT INTO mensajes (id_conversacion, id_remitente, contenido) 
      VALUES (?, ?, ?)`,
      [conversacionId, remitenteId, contenido]
    );
    
    // 2. Actualizar el timestamp (para ordenar en "Mis Chats")
    await connection.execute(
      'UPDATE conversaciones SET ultimo_mensaje_at = CURRENT_TIMESTAMP WHERE id_conversacion = ?',
      [conversacionId]
    );

    await connection.commit();
    
    nuevoMensaje = { 
      id_mensaje: msgResult.insertId,
      id_conversacion: conversacionId,
      id_remitente: remitenteId,
      contenido: contenido,
      fecha_envio: new Date().toISOString()
    };
    
    return nuevoMensaje;
    
  } catch (error) {
    await connection.rollback();
    throw error; 
  } finally {
    connection.release();
  }
}


// =================================================================
// RUTAS DE LA API (Mantenido sin cambios)
// =================================================================

app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
  // ... (Lógica de inserción de producto)
  const { id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado } = req.body;
  const imagen_url = req.file ? '/uploads/' + req.file.filename : null; 

  if (!id_usuario_vendedor || !nombre_producto || !precio || !imagen_url) {
    return res.status(400).json({ mensaje: 'Faltan datos requeridos (incluyendo la imagen).' });
  }

  const sql = "INSERT INTO productos (id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?)";
  
  try {
    const [result] = await pool.query(sql, [id_usuario_vendedor, nombre_producto, descripcion, precio, categoria_id, estado, imagen_url]);
    
    res.status(201).json({ 
      mensaje: 'Producto insertado con éxito', 
      id_producto: result.insertId,
      ruta_imagen: imagen_url
    });
  } catch (err) {
    console.error('Error al insertar producto:', err);
    if (req.file) {
      const fs = require('fs');
      fs.unlinkSync(req.file.path); 
    }
    res.status(500).json({ error: 'Error interno del servidor al insertar producto.' });
  }
});

app.get('/api/productos', async (req, res) => {
  // ... (Lógica de obtener productos)
  const sql = "SELECT * FROM productos";
  
  try {
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error al consultar productos:', err);
    res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
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

  // 1. REGISTRO SEGURO (AÑADIDO: Usa el token para registrar el socket)
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
  
  // 2. EL SUJETO/OBSERVABLE (AÑADIDO: El corazón del chat)
  socket.on('client:enviar_mensaje', async (data) => {
    try {
      const { idToken, remitenteId, productoId, contenido } = data; 
      
      // 2.1. SEGURIDAD: Re-verificar el remitente
      const uidVerificado = await verificarTokenFirebase(idToken);
      if (uidVerificado !== remitenteId) {
        throw new Error("Acceso denegado: Remitente falsificado.");
      }

      // 2.2. PERSISTENCIA: Guardar en MySQL
      const vendedorId = await obtenerVendedor(productoId); 
      
      const mensajeGuardado = await guardarMensaje(
        await obtenerOCrearConversacion(remitenteId, vendedorId, productoId), 
        remitenteId, 
        contenido
      ); 

      // 2.3. NOTIFICACIÓN: A los Observadores
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

  // Lógica de desconexión (Mantenido sin cambios)
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