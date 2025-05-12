import { Router } from 'express';
import { 
    obtenerPreguntasDeGuia,
    guardarGuia,
    obtenerGuiasCreadas,
    obtenerGuiasSeguidas
} from '../controllers/guias.controllers.js';
import { verifyToken } from '../controllers/cuenta.controllers.js';

const router = Router();

// Ruta para obtener las preguntas de una guía
router.get('/guias/preguntas',verifyToken, obtenerPreguntasDeGuia);

// Ruta para guardar una guía de estudio
router.post('/guias/guardar',verifyToken, guardarGuia);

// Ruta para obtener las guías creadas por el usuario autenticado
router.get('/guias/creadas', verifyToken, obtenerGuiasCreadas);

// Ruta para obtener las guías seguidas por el usuario autenticado
router.get('/guias/seguidas', verifyToken, obtenerGuiasSeguidas);

export default router;
