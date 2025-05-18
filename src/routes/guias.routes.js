import { Router } from 'express';
import {
    obtenerPreguntasDeGuia,
    guardarGuia,
    obtenerGuiasCreadas,
    obtenerGuiasSeguidas,
    obtenerParametros,
    obtenerGuiasEnRevision,
    obtenerGuiasEnRevisionAcad
} from '../controllers/guias.controllers.js';
import { verifyToken } from '../controllers/cuenta.controllers.js';

const router = Router();

// Ruta para obtener las preguntas de una guía
router.get('/guias/preguntas', obtenerPreguntasDeGuia);

// Ruta para guardar una guía de estudio
router.post('/guias/guardar', verifyToken, guardarGuia);

// Ruta para obtener las guías creadas por el usuario autenticado
router.get('/guias/creadas', verifyToken, obtenerGuiasCreadas);

// Ruta para obtener las guías seguidas por el usuario autenticado
router.get('/guias/seguidas', verifyToken, obtenerGuiasSeguidas);

//Obtener parametros para las guías
router.get('/guias/parametros', obtenerParametros);

//Obtener las solicitudes de validación PROFESOR
router.get('/guias/solicitudes/prof', verifyToken, obtenerGuiasEnRevision);

//Obtener las solicitudes de validación ACADEMIA
router.get('/guias/solicitudes/acad', obtenerGuiasEnRevisionAcad);

export default router;
