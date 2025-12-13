<?php
// === 1. ENCABEZADOS DE API (CORS) ===
// Permite que tu frontend acceda a este script PHP desde otra URL (si usas Firebase Hosting o CodeSandbox)
header('Access-Control-Allow-Origin: *'); 
header('Content-Type: application/json'); // Indica que la respuesta es JSON

// === 2. CREDENCIALES Y CONEXIÓN A MySQL ===
$servidor = "localhost";
$usuario = "root";
$contrasena = "";
$nombre_base_datos = "teschibazar"; // Nombre de la DB que creaste

// Conexión
$conexion = new mysqli($servidor, $usuario, $contrasena, $nombre_base_datos);

// Verificar si la conexión falló
if ($conexion->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Error de conexión a MySQL: " . $conexion->connect_error]);
    exit();
}
$conexion->set_charset("utf8");

// === 3. LÓGICA: OBTENER DATOS DE PRODUCTOS ===
$sql = "SELECT id_producto, nombre_producto, descripcion, precio, estado_producto FROM productos ORDER BY fecha_publicacion DESC LIMIT 10";
$resultado = $conexion->query($sql);

$productos = [];
if ($resultado && $resultado->num_rows > 0) {
    // Convertir cada fila a un objeto PHP (que se convertirá en JSON)
    while($fila = $resultado->fetch_assoc()) {
        $productos[] = $fila;
    }
}

// === 4. ENVIAR RESPUESTA JSON ===
echo json_encode($productos);

// Cerrar la conexión
$conexion->close();
?>