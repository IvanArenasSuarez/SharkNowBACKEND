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
        question: row.pregunta,
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
  const client = await pool.connect();
  try {
    const { guia, preguntas } = req.body;
    console.log(guia);
    console.log(preguntas);
    const {
      id, tipo, nombre, descripcion,
      id_usuario, id_materia, id_pde,
      version, estado
    } = guia;

    await client.query("BEGIN");

    let id_guia = id;

    // Crear nueva guía
    if (!id_guia) {
      const result = await client.query(
        `INSERT INTO guia_de_estudio (
          tipo, nombre, descripcion,
          id_usuario, id_materia, id_pde,
          num_seguidores, num_mesirve,
          version, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8)
        RETURNING id_gde`,
        [tipo, nombre, descripcion, id_usuario, id_materia, id_pde, version, estado]
      );
      id_guia = result.rows[0].id_gde;
    } else {
      // Actualizar guía existente
      await client.query(
        `UPDATE guia_estudio SET
          tipo = $1, nombre = $2, descripcion = $3,
          id_usuario = $4, id_materia = $5, id_pde = $6,
          version = $7, estado = $8
        WHERE id_gde = $9`,
        [tipo, nombre, descripcion, id_usuario, id_materia, id_pde, version, estado, id_guia]
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
    for (const id_reactivo of preguntas.eliminadas) {
      await client.query(
        `DELETE FROM reactivos WHERE id_reactivo = $1`,
        [parseInt(id_reactivo)]
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
