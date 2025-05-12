import { pool } from '../db.js';
import { verifyToken } from './cuenta.controllers.js';

const obtenerPreguntasDeGuia = async (req, res) => {
  const { id_guia } = req.query;

  try {
    if (!id_guia) {
      return res.status(400).json({ error: "Falta el parámetro id_guia" });
    }

    const result = await pool.query(
      'SELECT * FROM reactivo WHERE id_gde = $1',
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

