import { Router } from 'express';
import { 
    obtenerPreguntasPorGuia, 
    obtenerGuiasDeEstudio 
} from '../controllers/guias.controllers.js';
import { verifyToken } from '../controllers/cuenta.controllers.js';

const router = Router();

// Ruta para obtener las preguntas de una guia
router.get('/preguntas', obtenerPreguntasPorGuia);

export default router;
