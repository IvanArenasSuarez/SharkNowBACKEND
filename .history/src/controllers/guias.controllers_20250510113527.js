import { pool } from '../db.js';
import { verifyToken } from './cuenta.controllers.js';

exports.obtenerPreguntasPorGuia = async (req, res) => {
  let { id_guia, nombre, materia, academia, departamento, plan_estudios, descripcion } = req.query;

  try {
    if (!id_guia || id_guia === 'null') {
      // Validar que se incluyan los datos mínimos para crear la guía
      if (!nombre || !materia || !academia || !departamento || !plan_estudios) {
        return res.status(400).json({ error: 'Faltan datos para crear la guía' });
      }

      // Crear la guía
      const insertResult = await db.query(
        `INSERT INTO guia (nombre, materia, academia, departamento, plan_estudios, descripcion)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_guia`,
        [nombre, materia, academia, departamento, plan_estudios, descripcion || null]
      );

      const nuevoId = insertResult.rows[0].id_guia;

      return res.json({ id_guia: nuevoId, preguntas: [] });
    }

    // Si ya hay id_guia, devolver las preguntas asociadas
    const result = await db.query(
      `SELECT id_pregunta, tipo, enunciado, opciones, respuesta_correcta, relacion_a, relacion_b
       FROM pregunta
       WHERE id_gde = $1`,
      [parseInt(id_guia)]
    );

    res.json({ id_guia: parseInt(id_guia), preguntas: result.rows });
  } catch (error) {
    console.error('Error en obtenerPreguntasPorGuia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
