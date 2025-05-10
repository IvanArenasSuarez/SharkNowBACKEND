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
      req.user = decoded; // <- Aquí guardamos todo el objeto del token, no solo el ID
      next();
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
                descripcion,
                recompensas
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
                tipo_de_cuenta: user.tipo,
                descripcion: user.descripcion,
                recompensas: user.recompensas,
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
      WHERE g.estado = 'P'
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
      WHERE g.estado = 'P'
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
    const { rowCount } = await pool.query(
      `SELECT 1 FROM progreso_de_guias WHERE id_usuario = $1 AND id_gde = $2`,
      [id_usuario, id_gde]
    );

    res.json({ sigue: rowCount > 0 });
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


export { verifyToken };