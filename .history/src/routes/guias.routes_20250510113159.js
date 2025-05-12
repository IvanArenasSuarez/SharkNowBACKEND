import { Router } from 'express';
import { 
    obtenerPreguntasPorGuia, 
    obtenerGuiasDeEstudio 
} from '../controllers/guias.controllers.js';
import { verifyToken } from '../controllers/cuenta.controllers.js';

const router = Router();

// Ruta para obtener las preguntas de una guia
router.get('/preguntas', guiasController.obtenerPreguntasPorGuia);

// Ruta para registrar una nueva sesión de estudio
router.post('/sesion-estudio', registrarSesionEstudio);

export default router;
