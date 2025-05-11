// SM2.controller.js

import { pool } from '../db.js';
import { verifyToken } from './cuenta.controllers.js';

export const obtenerQuiz = [
  verifyToken,
  async (req, res) => {
    const id_usuario = req.userId;       
    const { id_gde } = req.params;  

    try {
      // Obtener los 15 IDs de reactivo a enviar
      const { rows: filasIds } = await pool.query(`
        SELECT sde.id_reactivo
        FROM sde_salidas sde
        WHERE sde.id_usuario = $1
          AND sde.id_gde     = $2
          AND (
            sde.fecha_ultima IS NULL
            OR sde.fecha_ultima + (sde.intervalo || ' days')::interval <= CURRENT_DATE
          )
        ORDER BY 
          (sde.fecha_ultima IS NOT NULL),
          sde.fecha_ultima
        LIMIT 15
      `, [id_usuario, id_gde]);

      const ids = filasIds.map(f => f.id_reactivo);

      if (ids.length === 0) {
        return res.status(404).json({ message: 'No hay preguntas disponibles para este quiz.' });
      }

      // 2️⃣ —> Query 2: obtener datos completos de los reactivos seleccionados
      const { rows: reactivos } = await pool.query(`
        SELECT
          id_reactivo,
          tipo,
          pregunta,
          respuestas,
          respuestas_correctas,
          pregunta_imagen,
          respuestas_imagenes
        FROM reactivos
        WHERE id_reactivo = ANY($1)
      `, [ids]);

      // 3️⃣ —> Preparar el formato del quiz
      const quiz = reactivos.map(r => {
        let pregunta = {
          text: r.pregunta,
          image: r.pregunta_imagen 
            ? `data:image/png;base64,${r.pregunta_imagen.toString('base64')}` 
            : null
        };

        let options = [];
        if (Array.isArray(r.respuestas)) {
          options = r.respuestas.map((opt, i) => {
            let respuesta = { text: opt };
            if (r.respuestas_imagenes && r.respuestas_imagenes[i]) {
              respuesta.image = `data:image/png;base64,${r.respuestas_imagenes[i].toString('base64')}`;
            }
            return respuesta;
          });
        }

        if (r.tipo === 'M') {
          return {
            type: "multipleChoice",
            question: pregunta,
            options: options.map(option => option.text),
            answer: r.respuestas_correctas[0]
          };
        }

        if (r.tipo === 'T') {
          return {
            type: "trueFalse",
            question: pregunta.text,
            options: ["Verdadero", "Falso"],
            answer: r.respuestas_correctas[0]
          };
        }

        if (r.tipo === 'C') {
          let pairs = r.respuestas.map((respuesta, index) => ({
            left: respuesta,
            right: r.respuestas_correctas[index]
          }));

          return {
            type: "matching",
            question: pregunta.text,
            pairs: pairs
          };
        }

        return null; // Tipo desconocido
      }).filter(q => q !== null);

      return res.json({ preguntas: quiz });

    } catch (error) {
      console.error('Error al obtener el quiz:', error);
      return res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }
];

/**
 * POST /api/sesion-estudio
 * Registra una sesión de estudio y actualiza los datos SM-2.
 */
export const registrarSesionEstudio = async (req, res) => {
  const { id_usuario, id_gde, respuestas, hora_inicio, hora_fin } = req.body;

  try {
    // 1️⃣ —> Verificar si ya existe sesión hoy
    const { rowCount: sesionesHoy } = await pool.query(`
      SELECT 1
      FROM "sesion_de_estudio"
      WHERE id_usuario = $1
        AND id_gde = $2
        AND fecha = CURRENT_DATE
    `, [id_usuario, id_gde]);

    if (sesionesHoy > 0) {
      return res.status(200).json({
        message: "Sesión ya registrada hoy. No se realizarán cambios."
      });
    }

    // 2️⃣ —> Verificar si es primera vez en esta guía
    const { rowCount: sesionesPrevias } = await pool.query(`
      SELECT 1
      FROM "sesion_de_estudio"
      WHERE id_usuario = $1
        AND id_gde = $2
    `, [id_usuario, id_gde]);
    const esPrimeraSesionGuia = sesionesPrevias === 0;

    // 3️⃣ —> Crear nueva sesión
    await pool.query(`
      INSERT INTO "sesion_de_estudio" (id_usuario, id_gde, hora_inicio, hora_fin, fecha)
      VALUES ($1, $2, $3, $4, CURRENT_DATE)
    `, [id_usuario, id_gde, hora_inicio, hora_fin]);

    // 4️⃣ —> Si es primera vez, inicializar todos los reactivos
    if (esPrimeraSesionGuia) {
      const { rows: todosReactivos } = await pool.query(`
        SELECT id_reactivo
        FROM reactivo
        WHERE id_gde = $1
      `, [id_gde]);

      for (const { id_reactivo } of todosReactivos) {
        await pool.query(`
          INSERT INTO "sde_salidas" (id_usuario, id_gde, id_reactivo, repeticion, intervalo, facilidad, fecha_ultima)
          VALUES ($1, $2, $3, 0, 0, 2.5, NULL)
        `, [id_usuario, id_gde, id_reactivo]);
      }
    }

    // 5️⃣ —> Actualizar cada reactivo contestado
    let correctas = 0;
    for (const { id_reactivo, calidad } of respuestas) {
      if (calidad >= 3) correctas++;

      const { rows } = await pool.query(`
        SELECT repeticion, intervalo, facilidad, fecha_ultima
        FROM "sde_salidas"
        WHERE id_usuario = $1
          AND id_gde = $2
          AND id_reactivo = $3
        LIMIT 1
      `, [id_usuario, id_gde, id_reactivo]);

      let { repeticion, intervalo, facilidad } = rows[0];

      // Ajustar SM-2
      if (calidad >= 3) {
        repeticion++;
        if (repeticion === 1) intervalo = 1;
        else if (repeticion === 2) intervalo = 6;
        else intervalo = Math.round(intervalo * facilidad);
      } else {
        repeticion = 0;
        intervalo = 1;
      }

      facilidad = Math.max(
        1.3,
        facilidad + (0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02))
      );

      await pool.query(`
        UPDATE "sde_salidas"
        SET repeticion = $1,
            intervalo = $2,
            facilidad = $3,
            fecha_ultima = CURRENT_DATE
        WHERE id_usuario = $4
          AND id_gde = $5
          AND id_reactivo = $6
      `, [repeticion, intervalo, facilidad, id_usuario, id_gde, id_reactivo]);
    }

    // 6️⃣ —> Responder
    res.status(200).json({
      message: "Sesión de estudio registrada y salidas actualizadas correctamente.",
      total: respuestas.length,
      correctas
    });

  } catch (error) {
    console.error("Error al registrar la sesión de estudio:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};