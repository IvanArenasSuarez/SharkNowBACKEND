import { Router } from 'express';
import { 
    obtenerQuiz, 
    registrarSesionEstudio 
} from '../controllers/SM2.controller.js';
import { verifyToken } from '../controllers/cuenta.controllers.js';

const router = Router();

// Ruta para obtener un quiz de 15 preguntas (protegido con verifyToken en el controlador)
router.get('/quiz/:id_gde',verifyToken, obtenerQuiz);

// Ruta para registrar una nueva sesión de estudio
router.post('/sesion-estudio', registrarSesionEstudio);

export default router;
