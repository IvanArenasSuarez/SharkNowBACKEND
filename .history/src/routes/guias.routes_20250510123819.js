import { Router } from 'express';
import { 
    obtenerPreguntasPorGuia,
    guardarGuia
} from '../controllers/guias.controllers.js';
import { verifyToken } from '../controllers/cuenta.controllers.js';

const router = Router();

// Ruta para obtener las preguntas de una guía
router.get('/preguntas', obtenerPreguntasPorGuia);

// Ruta para guardar una guía de estudio
router.post('/guardar', verifyToken, guardarGuia);

export default router;
