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
export const getCuentas = async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM cuenta_usuario");
    res.json(rows);
};
//GET Cuenta especifica
export const getCuenta = async (req, res) => {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM cuenta_usuario WHERE id_usuario = $1", [id]);

    if (rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json(rows[0]);
};
// POST Crear Cuenta
export const crearCuenta = async (req, res) => {

    const cliente = await pool.connect();

    try {
        const data = req.body;
        const { nombre, apellidos, correo, tipo, contrasena, academias } = data;

        if (!correo || !contrasena || !nombre || !apellidos) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        // Hashear la contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const desc = "Bienvenido a SharkNow";

        const { rows } = await cliente.query(
            "INSERT INTO usuarios (nombre, apellidos ,correo, tipo, contrasena, descripcion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [nombre, apellidos, correo, tipo, hashedPassword, desc]
        );

        const userId = rows[0].id_usuario;

        if (tipo === 2 && academias && academias.length > 0) {
            for (const academiaId of academias) {
                await cliente.query(
                    'INSERT INTO profesor_academia (id_usuario, id_academia, jefe) VALUES ($1, $2, $3)',
                    [userId, academiaId, false]
                );
            }
        }

        await cliente.query('COMMIT');

        const userResponse = await cliente.query(
            'SELECT * FROM usuarios WHERE id_usuario = $1',
            [userId]
        );

        return res.status(201).json(userResponse.rows[0]);
    }
    catch (err) {
        await cliente.query('ROLLBACK');
        console.error("Error al crear la cuenta: ", err);

        if (err.code === '23505') {
            return res.status(400).json({
                message: "El correo ya está registrado"
            });
        }
        return res.status(500).json({
            message: "Error interno del servidor",
            error: err.message
        });
    }
    finally {
        cliente.release();
    }
};

//GET Consultar Correo
export const consultarCorreo = async (req, res) => {
    try {
        const { correo } = req.params;

        const { rows } = await pool.query(
            'SELECT 1 FROM usuarios WHERE correo = $1 LIMIT 1',
            [correo]
        );

        const existe = rows.length > 0;

        res.json({ existe });
    }
    catch (err) {
        console.error("Error al verificar el correo: ", err);
        res.status(500).json({ error: "Error al verificar el correo" });
    }
};
//PUT Cambiar Contraseña
export const actualizarContrasena = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        if (!correo || !contrasena) {
            return res.status(400).json({
                success: false,
                message: "Correo y contraseña requeridos"
            });
        }

        const { rows: [usuario] } = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE correo = $1 LIMIT 1',
            [correo]
        );

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);

        const { rows: [usuarioActualizado] } = await pool.query(
            `UPDATE usuarios
             SET contrasena = $1
             WHERE correo = $2
             RETURNING id_usuario, correo`,
            [hashedPassword, correo]
        );

        res.status(200).json({
            success: true,
            message: "Contraseña actualizada exitosamente >w<",
            data: usuarioActualizado
        });
    }
    catch (err) {
        console.error("Error al actualizar contraseña: ", err);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: err.message
        });
    }
};

//GET Obtener Academias
export const obtenerAcademias = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM academias ORDER BY nombre'
        );
        res.json(rows);
    }
    catch (err) {
        console.error("Error al consultar las academias", err);
        res.status(500).json({
            success: false,
            message: "Error al consultar las academias",
            error: err.message
        });
    }
}

//DELATE borrar cuenta
export const borrarCuenta = async (req, res) => {
    const { id } = req.params;
    const { rowCount } = await pool.query(
        "DELETE FROM cuenta_usuario WHERE id_usuario = $1 RETURNING *",
        [id]
    );
    if (rowCount === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
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
    console.log("Credenciales: ", email, password);
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
        console.log("Contraseña en base de datos:", user.contrasena); // Depuración

        const valid = await bcrypt.compare(password, user.contrasena);
        // Compara la contraseña en texto plano
        if (!valid) {
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
                tipo_de_cuenta: user.tipo,
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