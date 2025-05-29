import { pool } from '../db.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';
const SECRET_KEY = "secreto_super_seguro"; // Cambia esto <-

// Middleware para verificar el token JWT
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.id_usuario; // Extraemos el ID del usuario desde el token
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
                descripcion,
                recompensas,
                estado
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

        if (!user.estado) {
            console.log("El acceso a esta cuenta ha sido denegado");
            return res.status(401).json({ message: "Acceso denegado" });
        }

        // Eliminar la contraseña antes de firmar el token
        delete user.contraseña;

        let academias = [];

        if (user.tipo === 2) {
            const result = await pool.query(
                `SELECT id_academia, jefe
           FROM profesor_academia
           WHERE id_usuario = $1`,
                [user.id_usuario]
            );

            academias = result.rows.map(a => ({
                id: a.id_academia,
                jefe: a.jefe
            }));
        }

        // Generar el token incluyendo la información del usuario y la empresa

        const token = jwt.sign(
            {
                id_usuario: user.id_usuario,
                nombre_usuario: user.nombre,
                apellidos_usuario: user.apellidos,
                tipo_de_cuenta: user.tipo,
                descripcion: user.descripcion,
                recompensas: user.recompensas,
                academias

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

//GET Recompensas para el avatar  

export const getRecompensasDesdeDB = async (req, res) => {
    const { id_usuario } = req.body;

    try {
        const user = await pool.query(
            "SELECT recompensas FROM usuarios WHERE id_usuario = $1",
            [id_usuario]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const recompensas = user.rows[0].recompensas;

        if (!recompensas || recompensas.length === 0) {
            return res.json({
                sombreros: [],
                tiburones: [],
                marcos: [],
                insignias: [],
            });
        }

        const { rows } = await pool.query(
            "SELECT id_recompensa, nombre, tipo, ENCODE(archivo, 'base64') as archivo FROM recompensas WHERE id_recompensa = ANY($1)",
            [recompensas]
        );

        const agrupadas = {
            sombreros: [],
            tiburones: [],
            marcos: [],
            insignias: [],
        };

        for (const r of rows) {
            const imgBase64 = `data:image/png;base64,${r.archivo}`;
            switch (r.tipo) {
                case '1': agrupadas.sombreros.push({ id: r.id_recompensa, nombre: r.nombre, archivo: imgBase64 }); break;
                case '2': agrupadas.tiburones.push({ id: r.id_recompensa, nombre: r.nombre, archivo: imgBase64 }); break;
                case '3': agrupadas.marcos.push({ id: r.id_recompensa, nombre: r.nombre, archivo: imgBase64 }); break;
                case '4': agrupadas.insignias.push({ id: r.id_recompensa, nombre: r.nombre, archivo: imgBase64 }); break;
            }
        }

        res.json(agrupadas);
    } catch (error) {
        console.error("Error al obtener recompensas:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// POST /avatar/guardar-imagen
export const guardarAvatarConImagen = async (req, res) => {
    try {
        const { id_usuario, id_sombrero, id_marco, id_insignia, id_tiburon } = req.body;

        // 1. Obtener imágenes base64 desde la tabla recompensas
        const recompensas = await pool.query(
            "SELECT id_recompensa, tipo, ENCODE(archivo, 'base64') as archivo FROM recompensas WHERE id_recompensa = ANY($1::text[])",
            [[id_sombrero, id_marco, id_insignia, id_tiburon]]
        );

        // 2. Clasificar imágenes
        let sombrero, marco, insignia, tiburon;
        for (const r of recompensas.rows) {
            const img = `data:image/png;base64,${r.archivo}`;
            switch (r.tipo) {
                case '1': sombrero = img; break;
                case '2': tiburon = img; break;
                case '3': marco = img; break;
                case '4': insignia = img; break;
            }
        }

        // 3. Crear canvas
        const canvasSize = 224; // 56*4
        const canvas = createCanvas(canvasSize, canvasSize);
        const ctx = canvas.getContext('2d');

        // 4. Cargar imágenes y dibujarlas
        const drawIfExists = async (imgBase64) => {
            if (!imgBase64) return;
            const response = await fetch(imgBase64);
            const buffer = await response.buffer();
            const img = await loadImage(buffer);
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
        };
        await drawIfExists(marco);
        await drawIfExists(tiburon);
        await drawIfExists(sombrero);
        // Dibujo de insignia más pequeña y centrada abajo
        if (insignia) {
            const response = await fetch(insignia);
            const buffer = await response.buffer();
            const img = await loadImage(buffer);

            const insigniaSize = 56;
            const x = (canvasSize - insigniaSize) / 2;
            const y = canvasSize - insigniaSize - 4; // un poco más arriba del borde inferior
            ctx.drawImage(img, x, y, insigniaSize, insigniaSize);
        }


        // 5. Convertir canvas a buffer
        const finalBuffer = canvas.toBuffer('image/png');

        // 6. Actualizar la tabla avatar
        await pool.query(`
      INSERT INTO avatar (
        id_user, id_sombrero, id_marco, id_insignia, id_tiburon, imagen
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id_user) DO UPDATE SET 
        id_sombrero = EXCLUDED.id_sombrero,
        id_marco = EXCLUDED.id_marco,
        id_insignia = EXCLUDED.id_insignia,
        id_tiburon = EXCLUDED.id_tiburon,
        imagen = EXCLUDED.imagen
    `, [id_usuario, id_sombrero, id_marco, id_insignia, id_tiburon, finalBuffer]);



        res.status(200).json({ message: "Avatar actualizado con imagen" });

    } catch (error) {
        console.error("Error al generar y guardar la imagen del avatar:", error);
        res.status(500).json({ message: "Error interno al guardar imagen" });
    }
};

// GET /avatar/seleccion?id_usuario=1
export const obtenerAvatarSeleccion = async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const { rows } = await pool.query(
            `SELECT id_sombrero, id_marco, id_insignia, id_tiburon 
       FROM avatar 
       WHERE id_user = $1`,
            [id_usuario]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "No hay selección de avatar" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Error al obtener selección del avatar:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// GET /avatar/imagen?id_usuario=1
export const obtenerImagenAvatar = async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const { rows } = await pool.query(
            "SELECT imagen FROM avatar WHERE id_user = $1",
            [id_usuario]
        );

        if (rows.length === 0 || !rows[0].imagen) {
            return res.status(404).json({ message: "Imagen no encontrada para este avatar." });
        }

        const buffer = rows[0].imagen;

        // Establece los encabezados para devolver la imagen
        res.setHeader("Content-Type", "image/png");
        res.send(buffer);
    } catch (error) {
        console.error("Error al obtener la imagen del avatar:", error);
        res.status(500).json({ message: "Error interno al obtener la imagen del avatar." });
    }
};

export const obtenerDatosPerfil = async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const result = await pool.query(
            "SELECT nombre, apellidos, correo, tipo, descripcion FROM usuarios WHERE id_usuario = $1",
            [id_usuario]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener los datos del perfil:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// Actualizar datos del perfil
export const actualizarDatosPerfil = async (req, res) => {
    const { id_usuario, nombre, apellidos, descripcion } = req.body;

    try {
        const result = await pool.query(
            `UPDATE usuarios 
       SET nombre = $1, apellidos = $2, descripcion = $3
       WHERE id_usuario = $4`,
            [nombre, apellidos, descripcion, id_usuario]
        );

        res.json({ mensaje: "Datos actualizados correctamente" });
    } catch (error) {
        console.error("Error al actualizar datos del perfil:", error);
        res.status(500).json({ error: "Error al actualizar datos del perfil" });
    }
};

// GET /usuarios/autores
export const buscarAutores = async (req, res) => {
    const { busqueda, id_usuario } = req.query;

    try {
        const values = [1, 2]; // Tipo 1 (alumno) y tipo 2 (profesor)

        let query = `
      SELECT id_usuario, nombre, apellidos, descripcion
      FROM usuarios
      WHERE tipo = ANY($1) 
        AND id_usuario != $2
    `;

        let params = [values, id_usuario];

        if (busqueda && busqueda.trim() !== "") {
            query += ` AND (LOWER(nombre) LIKE LOWER($3) OR LOWER(apellidos) LIKE LOWER($3))`;
            params.push(`%${busqueda}%`);
        }

        query += ` ORDER BY nombre ASC, apellidos ASC`;

        const { rows } = await pool.query(query, params);

        res.json(rows);
    } catch (error) {
        console.error("Error al buscar autores:", error);
        res.status(500).json({ message: "Error al buscar autores" });
    }
};

// GET /guias/buscar?nombre=xyz
export const buscarGuiasPorNombre = async (req, res) => {
    const { busqueda, id_usuario } = req.query;

    try {
        let query = `
      SELECT 
        g.id_gde,
        g.nombre AS nombre,
        g.descripcion,
        g.num_seguidores,
        g.num_mesirve,
        g.estado,
        CASE 
          WHEN g.tipo = 'E' THEN 'Extracurricular'
          ELSE m.nombre
        END AS nombre_materia,
        u.nombre AS nombre_autor,
        u.apellidos AS apellidos_autor,
        u.id_usuario,
        u.tipo AS tipo_autor
      FROM guias_de_estudio g
      LEFT JOIN materias m ON g.id_materia = m.id_materias
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      WHERE g.estado IN ('P', 'V') 
        AND u.id_usuario != $1
    `;

        const values = [id_usuario];

        if (busqueda) {
            query += ` AND LOWER(g.nombre) LIKE LOWER($2)`;
            values.push(`%${busqueda}%`);
        }

        query += ` ORDER BY g.nombre ASC`;

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        console.error("Error al buscar guías por nombre:", error);
        res.status(500).json({ message: "Error al buscar guías" });
    }
};


// GET /guias/buscar-por-materia?nombre_materia=xyz
export const buscarGuiasPorMateria = async (req, res) => {
    const { nombre_materia, id_usuario } = req.query;

    try {
        let values = [id_usuario];
        let query = `
      SELECT 
        g.id_gde,
        g.nombre AS nombre,
        g.descripcion,
        g.num_seguidores,
        g.num_mesirve,
        g.estado,
        CASE 
          WHEN g.tipo = 'E' THEN 'Extracurricular'
          ELSE m.nombre
        END AS nombre_materia,
        u.nombre AS nombre_autor,
        u.apellidos AS apellidos_autor,
        u.id_usuario,
        u.tipo AS tipo_autor
      FROM guias_de_estudio g
      LEFT JOIN materias m ON g.id_materia = m.id_materias
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      WHERE g.estado IN ('P', 'V')
        AND u.id_usuario != $1
    `;

        if (nombre_materia) {
            const nombreLower = nombre_materia.toLowerCase();
            if (nombreLower.includes('ex')) {
                query += ` AND g.tipo = 'E'`;
            } else {
                // Filtro por nombre de materia
                query += ` AND LOWER(m.nombre) LIKE LOWER($2)`;
                values.push(`%${nombre_materia}%`);
            }
        }

        query += ` ORDER BY g.nombre ASC`;

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        console.error("Error al buscar guías por materia:", error);
        res.status(500).json({ message: "Error al buscar guías por materia" });
    }
};

// GET /guias/sigue?id_usuario=1&id_gde=2
export const verificarSiSigueGuia = async (req, res) => {
    const { id_usuario, id_gde } = req.query;

    try {
        const result = await pool.query(
            `SELECT mesirve FROM progreso_de_guias WHERE id_usuario = $1 AND id_gde = $2 AND estado = 'A'`,
            [id_usuario, id_gde]
        );

        if (result.rowCount === 0) {
            return res.json({ sigue: false });
        }

        const { mesirve } = result.rows[0];
        return res.json({ sigue: true, mesirve });
    } catch (error) {
        console.error("Error al verificar seguimiento de guía:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// GET /guias/detalles?id_gde=1
export const obtenerDetallesGuia = async (req, res) => {
    const { id_gde } = req.query;

    try {
        const { rows } = await pool.query(`
      SELECT 
        g.nombre,
        g.descripcion,
        g.tipo,
        g.version,
        g.num_seguidores,
        g.num_mesirve,
        u.nombre AS nombre_autor,
        u.apellidos AS apellidos_autor,
        m.nombre AS nombre_materia,
        a.nombre AS nombre_academia,
        p.nombre AS nombre_programa,
        p.anio AS anio_plan
      FROM guias_de_estudio g
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      LEFT JOIN materias m ON g.id_materia = m.id_materias
      LEFT JOIN academias a ON m.id_academia = a.id_academia
      LEFT JOIN planes_de_estudio p ON g.id_pde = p.id_pde
      WHERE g.id_gde = $1
    `, [id_gde]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Guía no encontrada" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Error al obtener detalles de la guía:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};

export const seguirGuia = async (req, res) => {
    const { id_usuario, id_gde } = req.body;

    try {
        if (!id_usuario || !id_gde) {
            return res.status(400).json({ message: "Faltan datos requeridos" });
        }

        // Verificar si ya existe un registro para ese usuario y guía
        const { rowCount } = await pool.query(
            `SELECT 1 FROM progreso_de_guias WHERE id_usuario = $1 AND id_gde = $2`,
            [id_usuario, id_gde]
        );

        if (rowCount > 0) {
            // Si ya existe, solo actualiza el estado a 'A'
            await pool.query(
                `UPDATE progreso_de_guias SET estado = 'A' WHERE id_usuario = $1 AND id_gde = $2`,
                [id_usuario, id_gde]
            );
        } else {
            // Si no existe, inserta un nuevo registro
            await pool.query(
                `INSERT INTO progreso_de_guias (id_usuario, id_gde, estado, mesirve) VALUES ($1, $2, 'A', false)`,
                [id_usuario, id_gde]
            );
        }
        // Incrementar el número de seguidores en guias_de_estudio
        await pool.query(
            `UPDATE guias_de_estudio SET num_seguidores = num_seguidores + 1 WHERE id_gde = $1`,
            [id_gde]
        );

        res.status(200).json({ message: "Guía seguida exitosamente" });
    } catch (error) {
        console.error("Error al seguir la guía:", error);
        res.status(500).json({ message: "Error al seguir la guía" });
    }
};

export const marcarGuiaComoMeSirve = async (req, res) => {
    const { id_usuario, id_gde } = req.body;

    if (!id_usuario || !id_gde) {
        return res.status(400).json({ message: "Faltan datos requeridos." });
    }

    try {
        // Verifica si ya está marcada como mesirve
        const check = await pool.query(
            "SELECT mesirve FROM progreso_de_guias WHERE id_usuario = $1 AND id_gde = $2",
            [id_usuario, id_gde]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ message: "No se encontró registro de seguimiento para esta guía." });
        }

        if (check.rows[0].mesirve === true) {
            return res.status(400).json({ message: "La guía ya ha sido marcada como MeSirve." });
        }

        // Actualiza el estado de mesirve en progreso_de_guias
        await pool.query(
            "UPDATE progreso_de_guias SET mesirve = true WHERE id_usuario = $1 AND id_gde = $2",
            [id_usuario, id_gde]
        );

        // Incrementa el contador en guias_de_estudio
        await pool.query(
            "UPDATE guias_de_estudio SET num_mesirve = num_mesirve + 1 WHERE id_gde = $1",
            [id_gde]
        );

        res.status(200).json({ message: "MeSirve registrado correctamente." });

    } catch (error) {
        console.error("Error al marcar MeSirve:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

export const quitarMeSirve = async (req, res) => {
    const { id_usuario, id_gde } = req.body;

    try {
        await pool.query(`
      UPDATE progreso_de_guias 
      SET mesirve = false 
      WHERE id_usuario = $1 AND id_gde = $2
    `, [id_usuario, id_gde]);

        await pool.query(`
      UPDATE guias_de_estudio 
      SET num_mesirve = GREATEST(num_mesirve - 1, 0)
      WHERE id_gde = $1
    `, [id_gde]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error al quitar MeSirve:", error);
        res.status(500).json({ message: "Error al quitar MeSirve" });
    }
};

export const dejarDeSeguirGuia = async (req, res) => {
    const { id_usuario, id_gde } = req.body;

    try {

        if (!id_usuario || !id_gde) {
            return res.status(400).json({ message: "Faltan datos requeridos." });
        }

        // Desactivamos el seguimiento poniendo estado = 'I'
        await pool.query(
            `UPDATE progreso_de_guias 
       SET estado = 'I'
       WHERE id_usuario = $1 AND id_gde = $2`,
            [id_usuario, id_gde]
        );

        // Decrementamos el número de seguidores en guias_de_estudio
        await pool.query(
            `UPDATE guias_de_estudio 
       SET num_seguidores = GREATEST(num_seguidores - 1, 0)
       WHERE id_gde = $1`,
            [id_gde]
        );

        res.status(200).json({ message: "Guía desactivada del seguimiento correctamente" });
    } catch (error) {
        console.error("Error al dejar de seguir guía:", error);
        res.status(500).json({ message: "Error al dejar de seguir la guía" });
    }
};

export const registrarReporte = async (req, res) => {
    const { id_usuario, id_gde, categoria, descripcion, id_quienreporto } = req.body;

    if (!id_usuario || !id_gde || !categoria || !descripcion || !id_quienreporto) {
        return res.status(400).json({ message: "Faltan datos requeridos." });
    }

    try {
        // Validar si ya existe un reporte para esta guía, categoría y usuario que reporta
        const existing = await pool.query(
            `SELECT 1 FROM reportes 
       WHERE id_gde = $1 AND categoria = $2 AND id_quienreporto = $3`,
            [id_gde, categoria, id_quienreporto]
        );

        if (existing.rowCount > 0) {
            return res.status(409).json({
                message: "Ya has reportado esta guía por esa categoría.",
            });
        }

        const fechaActual = new Date();

        await pool.query(
            `INSERT INTO reportes (id_usuario, id_gde, categoria, descripcion, fecha, estado, id_quienreporto)
       VALUES ($1, $2, $3, $4, $5, 'P', $6)`,
            [id_usuario, id_gde, categoria, descripcion, fechaActual, id_quienreporto]
        );

        res.status(201).json({ message: "Reporte registrado correctamente." });
    } catch (error) {
        console.error("Error al registrar el reporte:", error);
        res.status(500).json({ message: "Error al registrar el reporte." });
    }
};

export const obtenerGuiasDeUsuario = async (req, res) => {
    const { id_usuario } = req.query;

    if (!id_usuario) {
        return res.status(400).json({ message: "Falta el parámetro id_usuario" });
    }

    try {
        const query = `
      SELECT 
        g.id_gde,
        g.nombre AS nombre,
        g.descripcion,
        g.num_seguidores,
        g.num_mesirve,
        g.estado,
        CASE 
          WHEN g.tipo = 'E' THEN 'Extracurricular'
          ELSE m.nombre
        END AS nombre_materia,
        u.nombre AS nombre_autor,
        u.apellidos AS apellidos_autor,
        u.id_usuario,
        u.tipo AS tipo_autor
      FROM guias_de_estudio g
      LEFT JOIN materias m ON g.id_materia = m.id_materias
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      WHERE g.estado IN ('P', 'V')
        AND u.id_usuario = $1
      ORDER BY g.nombre ASC;
    `;

        const { rows } = await pool.query(query, [id_usuario]);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener guías del usuario:", error);
        res.status(500).json({ message: "Error al obtener guías del usuario." });
    }
};

export const verificarJefeAcademia = async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const result = await pool.query(`
      SELECT 
        a.id_academia,
        a.nombre AS nombre_academia,
        COALESCE(p1.jefe, false) AS es_jefe,
        EXISTS (
          SELECT 1 
          FROM profesor_academia p2 
          WHERE p2.id_academia = a.id_academia AND p2.jefe = true
        ) AS academia_tiene_jefe
      FROM academias a
      JOIN profesor_academia p1 ON a.id_academia = p1.id_academia
      WHERE p1.id_usuario = $1
    `, [id_usuario]);

        res.json(result.rows);
    } catch (error) {
        console.error("Error al verificar jefe de academia:", error);
        res.status(500).json({ message: "Error al verificar jefe de academia" });
    }
};

export const asignarJefeAcademia = async (req, res) => {
    const { id_usuario, id_academia } = req.body;

    if (!id_usuario || !id_academia) {
        return res.status(400).json({ message: "Faltan datos requeridos." });
    }

    try {
        // Verificar que el usuario esté en esa academia
        const resultado = await pool.query(
            `SELECT * FROM profesor_academia WHERE id_usuario = $1 AND id_academia = $2`,
            [id_usuario, id_academia]
        );

        if (resultado.rowCount === 0) {
            return res.status(400).json({
                message: "El usuario no pertenece a esta academia.",
            });
        }

        // Verificar si ya existe un jefe en esa academia
        const { rows: jefesExistentes } = await pool.query(
            `SELECT * FROM profesor_academia WHERE id_academia = $1 AND jefe = true`,
            [id_academia]
        );

        if (jefesExistentes.length > 0) {
            return res.status(400).json({
                message: "Ya existe un jefe para esta academia.",
            });
        }

        // Actualizar el registro para poner jefe = true
        await pool.query(
            `UPDATE profesor_academia SET jefe = true WHERE id_usuario = $1 AND id_academia = $2`,
            [id_usuario, id_academia]
        );

        res.status(200).json({ message: "Jefe de academia asignado correctamente." });
    } catch (error) {
        console.error("Error al asignar jefe de academia:", error);
        res.status(500).json({ message: "Error del servidor al asignar jefe." });
    }
};

// Eliminar jefe de academia
export const quitarJefeAcademia = async (req, res) => {
    const { id_usuario, id_academia } = req.body;

    if (!id_usuario || !id_academia) {
        return res.status(400).json({ message: "Faltan datos requeridos." });
    }

    try {
        // Actualizar jefe a false para ese usuario y academia
        const result = await pool.query(
            `UPDATE profesor_academia
       SET jefe = false
       WHERE id_usuario = $1 AND id_academia = $2`,
            [id_usuario, id_academia]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Registro no encontrado." });
        }

        res.status(200).json({ message: "Jefatura eliminada correctamente." });
    } catch (error) {
        console.error("Error al quitar jefe:", error);
        res.status(500).json({ message: "Error al quitar la característica de jefe." });
    }
};

export const buscarJefeAcademia = async (req, res) => {
    const { id_academia } = req.params;
    try {
        const result = await pool.query(
            `SELECT u.nombre || ' ' || u.apellidos AS nombre_completo
      FROM profesor_academia pa
      JOIN usuarios u ON pa.id_usuario = u.id_usuario
      WHERE pa.id_academia = $1 AND pa.jefe = true
      LIMIT 1`,
            [id_academia]
        );
        if (result.rows.length === 0) {
            return res.status(406).json({ error: 'Responsable no encontrado' });
        }

        res.json({ nombre: result.rows[0].nombre_completo });
    } catch (error) {
        console.error('Error al obtener responsable:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

export const verificarTransferenciaJefe = async (req, res) => {
    const { id_origen, id_destino } = req.query;

    if (!id_origen || !id_destino) {
        return res.status(400).json({ message: "Faltan parámetros requeridos." });
    }

    try {
        // 1. Verificar que ambos sean tipo 2 (profesores)
        const resultUsuarios = await pool.query(
            `SELECT id_usuario, tipo FROM usuarios WHERE id_usuario IN ($1, $2)`,
            [id_origen, id_destino]
        );

        if (resultUsuarios.rowCount !== 2 || resultUsuarios.rows.some(u => u.tipo !== 2)) {
            return res.json({ puede_transferir: false, message: "Ambos usuarios deben ser profesores." });
        }

        // 2. Obtener academias donde el origen es jefe
        const academiasOrigen = await pool.query(
            `SELECT id_academia FROM profesor_academia WHERE id_usuario = $1 AND jefe = true`,
            [id_origen]
        );

        if (academiasOrigen.rowCount === 0) {
            return res.json({ puede_transferir: false, message: "El usuario origen no es jefe en ninguna academia." });
        }

        const idAcademiaJefe = academiasOrigen.rows[0].id_academia; // Solo puede ser jefe de una

        // 3. Verificar si el destino pertenece a esa academia
        const perteneceDestino = await pool.query(
            `SELECT 1 FROM profesor_academia WHERE id_usuario = $1 AND id_academia = $2`,
            [id_destino, idAcademiaJefe]
        );

        if (perteneceDestino.rowCount === 0) {
            return res.json({ puede_transferir: false, message: "El usuario destino no pertenece a la academia donde el origen es jefe." });
        }

        // 4. Verificar si el destino es jefe en alguna academia
        const esJefeDestino = await pool.query(
            `SELECT 1 FROM profesor_academia WHERE id_usuario = $1 AND jefe = true`,
            [id_destino]
        );

        if (esJefeDestino.rowCount > 0) {
            return res.json({ puede_transferir: false, message: "El usuario destino ya es jefe en alguna academia." });
        }

        // 5. Obtener el nombre de la academia
        const resultAcademia = await pool.query(
            `SELECT nombre FROM academias WHERE id_academia = $1`,
            [idAcademiaJefe]
        );

        const nombreAcademia = resultAcademia.rows[0]?.nombre || "Academia desconocida";

        return res.json({
            puede_transferir: true,
            id_academia: idAcademiaJefe,
            nombre_academia: nombreAcademia
        });

    } catch (error) {
        console.error("Error al verificar transferencia de jefatura:", error);
        res.status(500).json({ message: "Error al verificar transferencia de jefatura." });
    }
};

// VERIFICAR ESTADO DE USUARIO (RESTRINGIDO)
export const verificarEstadoUsuario = async (req, res) => {
    const { id_usuario } = req.query;

    if (!id_usuario) {
        return res.status(400).json({ message: "Falta el id_usuario." });
    }

    try {
        const result = await pool.query(
            `SELECT estado FROM usuarios WHERE id_usuario = $1`,
            [id_usuario]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        res.json({ estado: result.rows[0].estado }); // true o false
    } catch (error) {
        console.error("Error al verificar estado del usuario:", error);
        res.status(500).json({ message: "Error al consultar el estado del usuario." });
    }
};

// RESTRINGIR ACCESO A USUARIO
export const restringirAccesoUsuario = async (req, res) => {
    const { id_usuario } = req.body;

    if (!id_usuario) {
        return res.status(400).json({ message: "Falta el id_usuario." });
    }

    try {
        const result = await pool.query(
            `UPDATE usuarios SET estado = false WHERE id_usuario = $1`,
            [id_usuario]
        );

        res.json({ message: "Acceso restringido correctamente." });
    } catch (error) {
        console.error("Error al restringir acceso:", error);
        res.status(500).json({ message: "Error al restringir acceso al usuario." });
    }
};

// RESTAURAR ACCESO A USUARIO
export const restaurarAcceso = async (req, res) => {
    const { id_usuario } = req.body;

    if (!id_usuario) {
        return res.status(400).json({ message: "Falta el id del usuario." });
    }

    try {
        const result = await pool.query(
            `UPDATE usuarios SET estado = true WHERE id_usuario = $1`,
            [id_usuario]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        res.status(200).json({ message: "Acceso restaurado correctamente." });
    } catch (error) {
        console.error("Error al restaurar acceso:", error);
        res.status(500).json({ message: "Error al restaurar el acceso del usuario." });
    }
};

// Obtener reportes pendientes
export const obtenerReportesPendientes = async (req, res) => {
    try {
        const query = `
      SELECT 
        r.id_reporte,
        g.id_gde,
        g.nombre AS nombre_guia,
        r.categoria,
        r.descripcion,
        u.id_usuario,
        u.nombre AS nombre_autor,
        u.apellidos AS apellidos_autor,
        u.tipo AS tipo_autor
      FROM reportes r
      JOIN guias_de_estudio g ON r.id_gde = g.id_gde
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      WHERE r.estado = 'P'
      ORDER BY r.id_reporte DESC
    `;

        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener reportes pendientes:", error);
        res.status(500).json({ message: "Error al obtener reportes" });
    }
};

// Buscar reportes por nombre de guia
export const buscarReportesPorNombre = async (req, res) => {
    const { nombre, categoria } = req.query;

    try {
        let query = `
      SELECT 
        r.id_reporte,
        r.categoria,
        r.descripcion,
        r.id_gde,
        g.nombre AS nombre_guia,
        g.id_usuario,
        u.nombre AS nombre_autor,
        u.apellidos AS apellidos_autor
      FROM reportes r
      JOIN guias_de_estudio g ON r.id_gde = g.id_gde
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      WHERE r.estado = 'P'
    `;

        const values = [];
        let paramIndex = 1;

        if (nombre) {
            query += ` AND LOWER(g.nombre) LIKE LOWER($${paramIndex})`;
            values.push(`%${nombre}%`);
            paramIndex++;
        }

        if (categoria) {
            query += ` AND r.categoria = $${paramIndex}`;
            values.push(categoria);
            paramIndex++;
        }

        query += ` ORDER BY r.fecha ASC`;

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        console.error("Error al buscar reportes:", error);
        res.status(500).json({ message: "Error al buscar reportes" });
    }
};

// Mostrar lista negra
export const obtenerListaNegra = async (req, res) => {
    try {
        const query = `
      SELECT 
        u.id_usuario,
        u.nombre,
        u.apellidos,
        u.estado,
        COUNT(r.id_reporte) AS total_reportes
      FROM reportes r
      JOIN guias_de_estudio g ON r.id_gde = g.id_gde
      JOIN usuarios u ON g.id_usuario = u.id_usuario
      WHERE r.estado = 'A'
      GROUP BY u.id_usuario, u.nombre, u.apellidos
      ORDER BY total_reportes DESC;
    `;

        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener la lista negra:", error);
        res.status(500).json({ message: "Error al obtener la lista negra." });
    }
};

// Reportes anteriores para el perfil de usuario
export const obtenerReportesAnteriores = async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const query = `
      SELECT 
        r.id_reporte,
        r.categoria,
        g.nombre AS nombre_guia
      FROM reportes r
      JOIN guias_de_estudio g ON r.id_gde = g.id_gde
      WHERE g.id_usuario = $1 AND r.estado = 'A'
      ORDER BY r.fecha ASC;
    `;

        const values = [id_usuario];
        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener reportes anteriores:", error);
        res.status(500).json({ message: "Error al obtener reportes anteriores" });
    }
};

export { verifyToken };
