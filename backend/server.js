// =======================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK (Tomado del Stash)
// =======================================================
const admin = require('firebase-admin');

// ¡IMPORTANTE! Reemplaza 'ruta/a/tu/archivo-de-credenciales.json'
// con la ruta real de tu clave de servicio descargada de la consola de Firebase.
const serviceAccount = require('./ruta/a/tu/archivo-de-credenciales.json'); 

admin.initializeApp({
credential: admin.credential.cert(serviceAccount)
// Puedes añadir databaseURL si usas Realtime Database, pero aquí no es necesario
});
console.log('✅ Firebase Admin SDK inicializado.');

// =======================================================
// CONFIGURACIÓN DE DEPENDENCIAS Y SERVIDOR EXPRESS (Combinado)
// =======================================================
const express = require('express');
const mysql = require('mysql2/promise'); // Usaremos la versión con promesas para async/await
const cors = require('cors');
const multer = require('multer'); // Para manejar la carga de archivos
const path = require('path');  // Para manejar rutas de archivos
const http = require('http'); // Para el servidor HTTP
const { Server } = require('socket.io'); // Para WebSockets (Chat)

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Permite peticiones desde el Frontend
app.use(express.json()); // Permite que Express lea JSON en el body de las peticiones

// Servir archivos estáticos (para que el Frontend pueda ver las imágenes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (Tomado del Upstream - Pool)
// =======================================================
const dbConfig = {
  host: 'localhost',
  user: 'root', // Usuario por defecto de XAMPP
  password: '', // Contraseña por defecto de XAMPP
  database: 'teschibazar', // ¡Tu base de datos!
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool; // La conexión a la base de datos

// Función para inicializar la conexión
async function initializeDatabase() {
  try {
    pool = await mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    connection.release(); // Libera la conexión de vuelta al pool
    console.log('✅ Conexión a MySQL exitosa!');
  } catch (err) {
    console.error('❌ Error al conectar con MySQL:', err.message);
    process.exit(1); // Sale de la aplicación si no se puede conectar
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
// RUTAS DE LA API (Combinado)
// =================================================================

// 🚀 RUTA 1: POST - Insertar un nuevo producto con imagen (Tomado del Upstream)
app.post('/api/productos/insertar', upload.single('imagen'), async (req, res) => {
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

// 📚 RUTA 2: GET - Obtener todos los productos (Tomado del Upstream)
app.get('/api/productos', async (req, res) => {
  const sql = "SELECT * FROM productos";
  
  try {
    const [rows] = await pool.query(sql); // Ahora usa el pool
    res.json(rows);
  } catch (err) {
    console.error('Error al consultar productos:', err);
    res.status(500).json({ error: 'Error al obtener datos de la base de datos.' });
  }
});


// =======================================================
// INICIAR SERVIDOR HTTP Y WEBSOCKETS (CHAT) (Tomado del Stash)
// =======================================================
const server = http.createServer(app); 

// Montar Socket.IO sobre el servidor HTTP
const io = new Server(server, {
 // Configuración de CORS para Socket.IO
 cors: {
  origin: "*",
  methods: ["GET", "POST"]
 }
});

const usuariosConectados = {}; 

// --- LÓGICA DE WEBSOCKETS (SOCKET.IO) ---
io.on('connection', (socket) => {
 console.log(`Un usuario se ha conectado: ${socket.id}`);

 socket.on('client:registrar_usuario', (userId) => {
  usuariosConectados[userId] = socket.id;
  console.log(`Usuario ${userId} registrado con socket ${socket.id}`);
 });
 
 // Aquí irá la función principal del chat (El Sujeto/Observable)
 // socket.on('client:enviar_mensaje', async (data) => { ... });

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