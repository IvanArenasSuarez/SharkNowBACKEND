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
    res.status(200).json({ message: "Guía guardada correctamente", id_guia });

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
      'SELECT * FROM guias_de_estudio WHERE id_usuario = $1',
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
      'SELECT * FROM guias_de_estudio WHERE id_gde IN (SELECT id_gde FROM progreso_de_guias WHERE id_usuario = $1)',
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

            // 4. Eliminar la guía
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