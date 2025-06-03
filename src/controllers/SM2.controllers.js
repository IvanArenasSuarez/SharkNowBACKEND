// SM2.controller.js

import { pool } from '../db.js';
import { verifyToken } from './cuenta.controllers.js';

//Enviar las preguntas
export const obtenerQuiz = [
  
  verifyToken,
  async (req, res) => {
    const id_usuario = req.userId;
    const { id_gde } = req.params;
    console.log(id_usuario);
    console.log(id_gde);
    let primeraVez = false;
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    
    try {
      // Intentar obtener reactivos desde sde_salidas
      let { rows: filasIds } = await pool.query(`
        WITH candidatas AS (
        SELECT sde.id_reactivo
        FROM sde_salidas sde
        WHERE sde.id_usuario = $1
          AND sde.id_gde     = $2
          AND (
            sde.ultima_fecha IS NULL
            OR sde.ultima_fecha + (sde.intervalo || ' days')::interval <= CURRENT_DATE
          )
        ),
        complemento AS (
        SELECT sde.id_reactivo
        FROM sde_salidas sde
        WHERE sde.id_usuario = $1
          AND sde.id_gde     = $2
          AND sde.id_reactivo NOT IN (SELECT id_reactivo FROM candidatas)
        )
        SELECT id_reactivo
        FROM (
          SELECT id_reactivo FROM candidatas
          UNION ALL
          SELECT id_reactivo FROM complemento
        ) AS combinado
        LIMIT 15

      `, [id_usuario, id_gde]);

      let ids = filasIds.map(f => f.id_reactivo);

      // Si no hay registros válidos en sde_salidas, usar 15 preguntas aleatorias
      if (ids.length === 0) {
        console.log('No hay reactivos disponibles en sde_salidas. Usando aleatorios de reactivos.');
        const { rows: aleatorios } = await pool.query(`
          SELECT id_reactivo
          FROM reactivos
          WHERE id_gde = $1
          ORDER BY RANDOM()
          LIMIT 15
        `, [id_gde]);
        ids = aleatorios.map(r => r.id_reactivo);
        primeraVez=true;
      }

      // Si aún así no hay preguntas, mandar error
      if (ids.length === 0) {
        return res.status(404).json({ message: 'No hay preguntas disponibles para este quiz.' });
      }

      // Obtener los datos completos de los reactivos seleccionados
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

      // Preparar el formato del quiz
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
            id: parseInt(r.id_reactivo),
            type: "multipleChoice",
            question: pregunta.text.texto,
            options: options.map(option => option.text),
            answer: r.respuestas_correctas[0]
          };
        }

        if (r.tipo === 'T') {
          return {
            id: parseInt(r.id_reactivo),
            type: "trueFalse",
            question: pregunta.text.texto,
            options: ["Verdadero", "Falso"],
            answer: r.respuestas_correctas[0]
          };
        }

        if (r.tipo === 'C') {
          let pairs = r.respuestas.map((respuesta, index) => ({
            left: respuesta.izquierda,
            right: respuesta.derecha
          }));
          return {
          id: parseInt(r.id_reactivo),
          type: "matching",
          question: pregunta.text.texto,
          pairs: pairs
          };
        }


        return null;
      }).filter(q => q !== null);
      shuffleArray(quiz);
      return res.json({ preguntas: quiz ,primeraVez});
    } catch (error) {
      console.error('Error al obtener el quiz:', error);
      return res.status(500).json({ message: 'Error interno del servidor.' });
    }
  }
];

//Registrar resultados
export const registrarSesionEstudio = async (req, res) => {
  const { id_usuario, id_gde, respuestas, hora_inicio, hora_fin } = req.body;
  console.log(req.body);
  let correctas = 0;
  let questions = 0;
    for (const { id_reactivo, calidad } of respuestas) {
	    questions++;
      if (calidad >= 3) correctas++;
	}

  try {
    // Verificar si ya existe una sesión hoy
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

    // Verificar si es primera vez en esta guía
    const { rowCount: sesionesPrevias } = await pool.query(`
      SELECT 1
      FROM "sesion_de_estudio"
      WHERE id_usuario = $1
        AND id_gde = $2
    `, [id_usuario, id_gde]);
    const esPrimeraSesionGuia = sesionesPrevias === 0;

    // Nueva sesión
    await pool.query(`
      INSERT INTO sesion_de_estudio (id_usuario, id_gde, hora_inicio, hora_final, fecha,total_reactivos,correctas)
      VALUES ($1, $2, $3, $4, CURRENT_DATE,$5,$6)
    `, [id_usuario, id_gde, hora_inicio, hora_fin,questions,correctas]);

    // Inicializar todos los reactivos si es la primera vez
    if (esPrimeraSesionGuia) {
      console.log("nueva guia");
      const { rows: todosReactivos } = await pool.query(`
        SELECT id_reactivo
        FROM reactivos
        WHERE id_gde = $1
      `, [id_gde]);

      for (const { id_reactivo } of todosReactivos) {
        await pool.query(`
          INSERT INTO "sde_salidas" (id_usuario, id_gde, id_reactivo, repeticion, intervalo, facilidad, ultima_fecha)
          VALUES ($1, $2, $3, 0, 0, 2.5, NULL)
        `, [id_usuario, id_gde, id_reactivo]);
      }
    }

    // Actualizar cada reactivo contestado
    for (const { id_reactivo, calidad } of respuestas) {

      const { rows } = await pool.query(`
        SELECT repeticion, intervalo, facilidad, ultima_fecha
        FROM "sde_salidas"
        WHERE id_usuario = $1
          AND id_gde = $2
          AND id_reactivo = $3
        LIMIT 1
      `, [id_usuario, id_gde, id_reactivo]);

      let { repeticion, intervalo, facilidad } = rows[0];
      facilidad = parseFloat(facilidad)

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
            ultima_fecha = CURRENT_DATE
        WHERE id_usuario = $4
          AND id_gde = $5
          AND id_reactivo = $6
      `, [repeticion, intervalo, facilidad, id_usuario, id_gde, id_reactivo]);
    }

    // Mensaje de confirmacion
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