import { pool } from '../db.js';
import { verifyToken } from './cuenta.controllers.js';

export const obtenerPreguntasDeGuia = async (req, res) => {
  const { id_guia } = req.query;
  try {
    if (!id_guia) {
      return res.status(400).json({ error: "Falta el parámetro id_guia" });
    }

    const result = await pool.query(
      'SELECT * FROM reactivos WHERE id_gde = $1',
      [id_guia]
    );

    const preguntas = result.rows.map((row) => {
      let type;
      if (row.tipo === 'M') type = 'multipleChoice';
      else if (row.tipo === 'T') type = 'trueFalse';
      else if (row.tipo === 'C') type = 'matching';

      return {
        id: row.id_reactivo.toString(),
        type,
        question: row.pregunta.texto,
        options: row.respuestas,
        answer: row.respuestas_correctas,
      };
    });
    res.json(preguntas);
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    res.status(500).json({ error: 'Error al obtener las preguntas' });
  }
};

export const guardarGuia = async (req, res) => {
  const userId = req.userId;
  const client = await pool.connect();
  try {
    const { guia, preguntas } = req.body;
    await client.query("BEGIN");
    let id_guia = parseInt(guia.id);
    // Crear nueva guía
    if (id_guia === 0) {
      const result = await client.query(
        `INSERT INTO guias_de_estudio (
          tipo, nombre, descripcion,
          id_usuario, id_materia, id_pde,
          num_seguidores, num_mesirve,
          version, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8)
        RETURNING id_gde`,
        [guia.tipo, guia.nombre, guia.descripcion, userId, guia.materia, guia.plan, guia.version, guia.estado]
      );
      id_guia = result.rows[0].id_gde;
      
      // 1. Contar cuántas guías ha creado el usuario
      const { rows: totalGuiasRows } = await client.query(`Add commentMore actions
        SELECT COUNT(*)::int AS total
        FROM guias_de_estudio
        WHERE id_usuario = $1
      `, [userId]);

      const totalGuias = totalGuiasRows[0].total;

      // 2. Verificar si toca recompensa (primera guía o múltiplo de 3)
      if (totalGuias === 1 || totalGuias % 3 === 0) {
        // 3. Obtener recompensas actuales del usuario
        const { rows: usuarioRows } = await client.query(`
          SELECT recompensas
          FROM usuarios
          WHERE id_usuario = $1
        `, [userId]);

        const recompensasActuales = usuarioRows[0].recompensas || [];

        // 4. Buscar recompensas tipo 2 o 4 que no tenga el usuario
        const { rows: recompensasDisponibles } = await client.query(`
          SELECT id_recompensa, nombre, tipo
          FROM recompensas
          WHERE tipo IN ('2', '4')
            AND id_recompensa <> ALL($1::varchar[])
        `, [recompensasActuales]);

        if (recompensasDisponibles.length > 0) {
          // 5. Elegir una al azar
          const recompensa = recompensasDisponibles[Math.floor(Math.random() * recompensasDisponibles.length)];

          // 6. Insertar recompensa para el usuario
          await client.query(`
            UPDATE usuarios
            SET recompensas = array_append(recompensas, $1)
            WHERE id_usuario = $2
          `, [recompensa.id_recompensa, userId]);

          // 7. Puedes devolver esta recompensa en la respuesta para mostrar al usuario
          res.locals.recompensaNueva = {
            id: recompensa.id_recompensa,
            nombre: recompensa.nombre,
            tipo: recompensa.tipo === '2' ? 'Insignias' : 'Tiburones'
          };
        }
      }
  
    } else {
      // Actualizar guía existente
      await client.query(
        `UPDATE guias_de_estudio SET
          tipo = $1, nombre = $2, descripcion = $3,
          id_usuario = $4, id_materia = $5, id_pde = $6,
          version = $7, estado = $8
        WHERE id_gde = $9`,
        [guia.tipo, guia.nombre, guia.descripcion, userId, guia.materia, guia.plan, guia.version, guia.estado, id_guia]
      );
    }

    // INSERTAR nuevas preguntas
    for (const p of preguntas.nuevas) {
      const tipo = p.type === "multipleChoice" ? "M" :
        p.type === "trueFalse" ? "T" :
          p.type === "matching" ? "C" : null;

      const preguntaJson = { texto: p.question };
      const respuestasJson = p.options;
      let respuestasCorrectas = null;

      if (tipo === "M" || tipo === "T") {
        respuestasCorrectas = [p.answer];
      } else if (tipo === "C") {
        respuestasCorrectas = p.options;
      }

      await client.query(
        `INSERT INTO reactivos (
          id_gde, tipo, pregunta, respuestas, respuestas_correctas
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          id_guia,
          tipo,
          preguntaJson,
          JSON.stringify(respuestasJson),
          JSON.stringify(respuestasCorrectas)
        ]
      );
    }

    // ACTUALIZAR preguntas editadas
    for (const p of preguntas.editadas) {
      const tipo = p.type === "multipleChoice" ? "M" :
        p.type === "trueFalse" ? "T" :
          p.type === "matching" ? "C" : null;

      const preguntaJson = { texto: p.question };
      const respuestasJson = p.options;
      let respuestasCorrectas = null;

      if (tipo === "M" || tipo === "T") {
        respuestasCorrectas = [p.answer];
      } else if (tipo === "C") {
        respuestasCorrectas = p.options;
      }

      await client.query(
        `UPDATE reactivos SET 
          tipo = $1,
          pregunta = $2,
          respuestas = $3,
          respuestas_correctas = $4
        WHERE id_reactivo = $5`,
        [
          tipo,
          preguntaJson,
          JSON.stringify(respuestasJson),
          JSON.stringify(respuestasCorrectas),
          parseInt(p.id)
        ]
      );
    }

    // ELIMINAR preguntas eliminadas
    for (const item of preguntas.eliminadas) {
      const id_reactivo = parseInt(item.id);
      await client.query(`DELETE FROM reactivos WHERE id_reactivo = $1`,
        [id_reactivo]
      );
    }

    await client.query("COMMIT");
    const respuesta = { message: "Guía guardada correctamente", id_guia };
    if (res.locals.recompensaNueva) {
      respuesta.recompensa = res.locals.recompensaNueva;
    }
    res.status(200).json(respuesta);


  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al guardar la guía:", error);
    res.status(500).json({ error: "Error al guardar la guía" });
  } finally {
    client.release();
  }
};

// Obtener guias creadas por el usuario
export const obtenerGuiasCreadas = async (req, res) => {
  const userId = req.userId; // Obtiene el ID del usuario del token
  try {
    const result = await pool.query(
      `SELECT
          gde.id_gde,
          gde.tipo,
          gde.nombre,
          gde.descripcion,
          gde.id_usuario,
          gde.id_materia,
          gde.id_pde,
          gde.version,
          gde.estado,
          m.nombre AS nombre_materia,
          aca.nombre AS nombre_academia,
          pde.nombre AS nombre_pde,
          us.nombre AS nombre_usuario,
          us.apellidos
        FROM
          guias_de_estudio gde
        JOIN
          materias m ON gde.id_materia = m.id_materias
        JOIN
          academias aca ON m.id_academia = aca.id_academia
        JOIN
          planes_de_estudio pde ON gde.id_pde = pde.id_pde
        JOIN
          usuarios us ON gde.id_usuario = us.id_usuario
        WHERE
          gde.id_usuario = $1
      `,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron guías creadas por el usuario.' });
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener las guías creadas:', error);
    res.status(500).json({ error: 'Error al obtener las guías creadas' });
  }
};

// Función para obtener las guías seguidas por el usuario SIN TERMINAR
export const obtenerGuiasSeguidas = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await pool.query(
      `SELECT
          gde.id_gde,
          gde.tipo,
          gde.nombre AS nombre_gde,
          gde.descripcion AS descripcion,
          gde.id_usuario,
          gde.id_materia,
          gde.version,
          gde.estado AS estado_gde,
          m.nombre AS nombre_materia,
          aca.nombre AS nombre_academia,
          pde.nombre AS nombre_pde,
          us.nombre AS nombre_usuario,
          us.apellidos
        FROM
          guias_de_estudio gde
        JOIN
          materias m ON gde.id_materia = m.id_materias
        JOIN
          academias aca ON m.id_academia = aca.id_academia
        JOIN
          planes_de_estudio pde ON m.id_pde = pde.id_pde
        JOIN
          usuarios us ON gde.id_usuario = us.id_usuario
        WHERE
          gde.id_gde IN (SELECT id_gde FROM progreso_de_guias WHERE id_usuario = $1 AND estado = 'A')
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron guías seguidas por el usuario.' });
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener las guías seguidas:', error);
    res.status(500).json({ error: 'Error al obtener las guías seguidas' });
  }
};

//GET Obtener la información de las sesiones programadas
export const obtenerInfoProgreso = async (req, res) => {
  const { id_gde, id_usuario } = req.query;
  try {
    const result = await pool.query(`
      SELECT
        estado,
        fecha_inicio,
        fecha_final,
        dias,
        hora,
        mesirve
      FROM
        progreso_de_guias
      WHERE
        id_gde = $1 AND id_usuario = $2;
    `, [id_gde, id_usuario]);
    res.json(result.rows);
  }
  catch (err) {
    console.error('Error al obtener la información de las sesiones programadas', err);
    res.status(500).json({ error: 'Error al obtener la información de las sesiones programadas' });
  }
};

//PUT Actualizar la información de las sesiones programadas
export const actualizarInfoProgreso = async (req, res) => {
  const { id_gde, id_usuario, fecha_inicio, fecha_final, dias, hora } = req.body;

  if (!Array.isArray(dias)) {
    return res.status(400).json({
      error: "El campo 'dias' debe ser un array"
    });
  }

  try {
    const diasJSON = JSON.stringify(dias);
    /*
        console.log("id_gde: ", id_gde);
        console.log("id_usuario: ", id_usuario);
        console.log("fecha_inicio: ", fecha_inicio);
        console.log("fecha_final: ", fecha_final);
        console.log("dias: ", dias);
        console.log("hora: ", hora);
    */
    const result = await pool.query(`
      UPDATE 
        progreso_de_guias
      SET
        fecha_inicio = $1,
        fecha_final = $2,
        dias = $3,
        hora = $4
      WHERE
        id_gde = $5 AND id_usuario = $6
      RETURNING *;
      `, [fecha_inicio, fecha_final, diasJSON, hora, id_gde, id_usuario]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Registro no encontrado",
        message: `No se encontró progreso para la guía ${id_gde} y usuario ${id_usuario}. Verifica los IDs.`
      });
    }

    res.json(result.rows);
  }
  catch (err) {
    console.error('Error al actualizar los datos del progreso de guias.', err);
    res.status(500).json({
      error: 'Error al actualizar los datos del progreso de guias',
      details: err.message
    });
  }
};

export const eliminarGuia = async (req, res) => {
  const idGuia = req.params.id;

  try {
    // 1. Verificar si existe y sus condiciones
    const result = await pool.query(
      'SELECT estado, num_seguidores FROM guias_de_estudio WHERE id_gde = $1',
      [idGuia]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Guía no encontrada' });
    }

    const { estado, num_seguidores } = result.rows[0];

    // 2. Validar condiciones para poder eliminar
    if (estado === 'N' || (estado === 'P' && num_seguidores === 0)) {
      // 3. Eliminar reactivos asociados
      await pool.query('DELETE FROM reactivos WHERE id_gde = $1', [idGuia]);
      // 4. Elimina las solicitudes de validacion
      await pool.query('DELETE FROM solicitudes_de_validacion WHERE id_gde = $1', [idGuia]);
      // 5. Eliminar la guía
      await pool.query('DELETE FROM guias_de_estudio WHERE id_gde = $1', [idGuia]);

      return res.status(200).json({ message: 'Guía y reactivos eliminados correctamente' });
    } else {
      return res.status(400).json({ message: 'No se puede eliminar la guía: está publicada y tiene seguidores.' });
    }
  } catch (err) {
    console.error('Error al eliminar la guía:', err);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

export const obtenerParametros = async (req, res) => {
  const userId = req.userId;
  try {
    const client = await pool.connect();

    const [materias, academias, plan] = await Promise.all([
      client.query(`
        SELECT 
          m.id_materias, 
          m.nombre, 
          m.id_academia,
          m.id_pde
        FROM materias m`),
      client.query('SELECT id_academia, nombre FROM academias'),
      client.query('SELECT id_pde, nombre, anio FROM planes_de_estudio')
    ]);

    client.release();

    res.json({
      materias: materias.rows,
      academias: academias.rows,
      plan: plan.rows
    });
  }
  catch (err) {
    console.error('Error al obtener las opciones', err);
    res.status(500).json({ error: 'Error al obtener las opciones' });
  }
};

//PUT Actualizar el estado de la guía de estudio
export const publicarGuia = async (req, res) => {
  const { id_gde } = req.body;

  try {
    const result = await pool.query(`
      UPDATE
        guias_de_estudio
      SET
        estado = 'P'
      WHERE
        id_gde = $1
      RETURNING
        *;
    `, [id_gde]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Registro no Encontrado",
        message: `No se encontró la guia con id: ${id_gde} Verifica los IDs.`
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  }
  catch (err) {
    console.error('Error al publicar la guía de estudio', err);
    res.status(500).json({
      error: 'Error al publicar la guía de estudio',
      details: err.message
    });
  }
}

//POST Crear solicitud de validación por Academia
export const enviarSolicitud = async (req, res) => {
  const { id_usuario, id_gde } = req.body;
  try {
    // Primero verificar si ya existe
    const existe = await pool.query(
      `SELECT 1 FROM solicitudes_de_validacion 
        WHERE id_gde = $1 AND id_usuario = $2`,
      [id_gde, id_usuario]
    );

    let result;
    if (existe.rowCount > 0) {
      // Actualizar si existe
      result = await pool.query(`
        UPDATE solicitudes_de_validacion
        SET estado = 'E',
            motivo_de_rechazo = NULL
        WHERE id_gde = $1 AND id_usuario = $2
        RETURNING *;
      `, [id_gde, id_usuario]);
    } else {
      // Insertar si no existe
      result = await pool.query(`
        INSERT INTO solicitudes_de_validacion 
          (id_gde, id_usuario, estado)
        VALUES ($1, $2, 'E')
        RETURNING *;
      `, [id_gde, id_usuario]);
    }

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Registro no Encontrado",
        message: `No se pudo crear/actualizar la solicitud`
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error al procesar la solicitud', err);
    res.status(500).json({
      error: 'Error al procesar la solicitud',
      details: err.message
    });
  }
}

//GET guías en revisión PROF
export const obtenerGuiasEnRevision = async (req, res) => {
  const userId = req.userId; // Obtiene el ID del usuario del token

  try {
    const result = await pool.query(
      `SELECT 
        sv.id_solicitud,
        sv.id_gde,
        sv.estado,
        sv.motivo_de_rechazo,
        g.tipo,
        g.nombre AS nombre,
        g.descripcion,
        g.id_materia,
        g.id_pde,
        g.num_seguidores,
        g.version,
        g.estado AS guia_estado
      FROM 
        solicitudes_de_validacion sv
      JOIN
        guias_de_estudio g ON sv.id_gde = g.id_gde
      WHERE 
        sv.id_usuario = $1`, [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron solicitudes de revisión' });
    }

    res.json(result.rows);
  }
  catch (err) {
    console.error('Error al obtener las guías en revisión', err);
    res.status(500).json({ error: 'Error al obtener las guías en revisión' });
  }
};

//GET guias en revisión ACADEMIA
export const obtenerGuiasEnRevisionAcad = async (req, res) => {
  const { id_academia } = req.query;
  try {
    const result = await pool.query(
      `SELECT 
        sv.id_solicitud,
        sv.id_gde,
        sv.estado,
        us.id_usuario AS id_usuario,
        us.nombre AS nombre_usuario,
        us.apellidos AS apellidos,
        gde.tipo,
        gde.nombre AS nombre_guia,
        gde.descripcion AS descripcion,
        gde.id_materia,
        gde.id_pde,
        gde.version,
        m.nombre AS nombre_materia,
        gde.estado AS guia_estado,
        aca.nombre AS nombre_academia,
        pde.nombre AS nombre_pde
      FROM 
        solicitudes_de_validacion sv
      JOIN 
        guias_de_estudio gde ON sv.id_gde = gde.id_gde
      JOIN 
        materias m ON gde.id_materia = m.id_materias
      JOIN
        academias aca ON m.id_academia = aca.id_academia
      JOIN
        planes_de_estudio pde ON m.id_pde = pde.id_pde
      JOIN
        usuarios us ON gde.id_usuario = us.id_usuario
      WHERE 
        m.id_academia = $1
        AND sv.estado = 'E'`,
      [id_academia]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'No hay guías en solicitud de revisión' });
    }
    res.json(result.rows);
  }
  catch (err) {
    console.error('Error al obtener las guías en revisión', err);
    res.status(500).json({ error: 'Error al obtener las guias en revisión' });
  }
};

export const rechazarGuiaAcademia = async (req, res) => {
  const { id_solicitud, motivo } = req.body;

  try {
    const result = await pool.query(`
      UPDATE
        solicitudes_de_validacion
      SET
        estado = 'R',
        motivo_de_rechazo = $1
      WHERE
        id_solicitud = $2
      RETURNING *;
    `, [motivo, id_solicitud]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Registro no Encontrado",
        message: `No se encontró solicitud con id: ${id_solicitud} Verifica los IDs.`
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  }
  catch (err) {
    console.error('Error al rechazar la guía de estudio', err);
    res.status(500).json({
      error: 'Error al rechazar la guia de estudio',
      details: err.message
    });

  }
};

//POST Aceptar validación y eliminar solicitud
export const aceptarValidacion = async (req, res) => {
  const { id_gde, id_solicitud } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const aceptar = await client.query(`
      UPDATE
        guias_de_estudio
      SET
        estado = 'V'
      WHERE
        id_gde = $1
      RETURNING *;
    `, [id_gde]);

    if (aceptar.rowCount === 0) {
      throw new Error(`Guia con id_gde = ${id_gde} no encontrada`);
    }

    const eliminar = await client.query(`
      DELETE FROM
        solicitudes_de_validacion
      WHERE
        id_solicitud = $1
      RETURNING *;
    `, [id_solicitud]);

    if (eliminar.rowCount === 0) {
      throw new Error(`Solicitud con id_solicitud = ${id_solicitud} no encontrada`);
    }

    await client.query('COMMIT');
    res.status(200).json({
      success: true,
      guia: aceptar.rows[0],
      solicitud: eliminar.rows[0]
    });
  }
  catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
  finally {
    client.release();
  }
};
