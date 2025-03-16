import { pool } from '../db.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const SECRET_KEY = "secreto_super_seguro"; // Cambia esto <-

// Middleware para verificar el token JWT
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Obtener el token desde el header

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.id; // Extraemos el ID del usuario desde el token
        next(); // Procedemos a la siguiente función
    } catch (error) {
        return res.status(401).json({ message: 'Token no válido.' });
    }
};


//GET Cuentas
export const getCuentas = async (req,res)=>{
    const { rows } = await pool.query("SELECT * FROM cuenta_usuario");
    res.json(rows);
};
//GET Cuenta especifica
export const getCuenta = async (req,res)=>{
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM cuenta_usuario WHERE id_usuario = $1", [id]);
    
    if(rows.length === 0){
        return res.status(404).json({ message: "User not found"});
    }
    res.json(rows[0]);
};
// POST Crear Cuenta
export const crearCuenta = async (req, res) => {
    const data = req.body;
    const { nombre, corrreo, telefono, contraseña, tipo_de_cuenta, id_empresa } = data;

    if (!corrreo || !contraseña || !nombre) {
        return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    const { rows } = await pool.query(
        "INSERT INTO cuenta_usuario (id_empresa, nombre, corrreo, telefono, contraseña, tipo_de_cuenta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [id_empresa, nombre, corrreo, telefono, hashedPassword, tipo_de_cuenta]
    );
    return res.status(201).json(rows[0]);
};
//DELATE borrar cuenta
export const borrarCuenta = async (req,res)=>{
    const { id } = req.params;
    const { rowCount } = await pool.query(
        "DELETE FROM cuenta_usuario WHERE id_usuario = $1 RETURNING *",
        [id]
    );
    if(rowCount === 0){
        return res.status(404).json({message: "Usuario no encontrado"});
    }
    return res.sendStatus(204);
};
// PUT actualizar cuenta
export const putCuenta = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const { nombre, corrreo, telefono, contraseña, tipo_de_cuenta, id_empresa } = data;

    // Hashear la nueva contraseña si es que se actualiza
    const hashedPassword = contraseña ? await bcrypt.hash(contraseña, 10) : undefined;

    const { rows } = await pool.query(
        "UPDATE cuenta_usuario SET id_empresa = $1, nombre = $2, corrreo = $3, telefono = $4, contraseña = $5, tipo_de_cuenta = $6 WHERE id_usuario = $7 RETURNING *",
        [
            id_empresa, nombre, corrreo, telefono, 
            hashedPassword || contraseña, tipo_de_cuenta, id
        ]
    );
    return res.json(rows[0]);
};


// POST Login y generación de token
export const loginCuenta = async (req, res) => {
    const { email, password } = req.body;
console.log("Credenciales: ",email,password);
    try {
        // Buscar al usuario por correo electrónico e incluir los datos de la empresa
        const { rows } = await pool.query(
            `SELECT 
                id_usuario, 
                nombre,
                apellidos, 
                contrasena,
                tipo,
                descripcion
                FROM usuarios
            WHERE correo = $1;
            `,
            [email]
        );

        // Si no se encuentra el usuario
        if (rows.length === 0) {
            console.log(`Usuario con correo ${email} no encontrado.`);
            return res.status(401).json({ message: "Credenciales inválidas" });
        }

        const user = rows[0];

        console.log("Contraseña recibida:", password); // Depuración
        console.log("Contraseña en base de datos:", user.contraseña); // Depuración

        // Compara la contraseña en texto plano
        if (user.contrasena !== password) {
            console.log("Contraseña incorrecta para el usuario:", email);
            return res.status(401).json({ message: "Credenciales inválidas" });
        }

        // Eliminar la contraseña antes de firmar el token
        delete user.contraseña;

        // Generar el token incluyendo la información del usuario y la empresa
        const token = jwt.sign(
            {
                id_usuario: user.id_usuario,
                nombre_usuario: user.nombre,
                apellidos_usuario: user.apellidos,
                tipo_de_cuenta: user.tip,
                descripcion: user.descripcion,
            },
            SECRET_KEY,
            { expiresIn: "2h" }
        );

        console.log("Token generado:", token);

        // Enviar el token
        res.status(200).json({ token }); //Depuracion
    } catch (error) {
        console.error("Error en la autenticación:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};

export { verifyToken };