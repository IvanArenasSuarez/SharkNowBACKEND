import { Router } from 'express';
import {
    obtenerPreguntasDeGuia,
    guardarGuia,
    obtenerGuiasCreadas,
    obtenerGuiasSeguidas,
    eliminarGuia,
    obtenerParametros,
    obtenerGuiasEnRevision,
    obtenerGuiasEnRevisionAcad,
    obtenerInfoProgreso,
    actualizarInfoProgreso,
    rechazarGuiaAcademia,
    aceptarValidacion,
    publicarGuia,
    enviarSolicitud,
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

//Publicar guía de estudio
router.put('/guias/publicar', verifyToken, publicarGuia);

//Crear solicitud de validación por academia
router.post('/guias/enviarSolicitud', verifyToken, enviarSolicitud);

//Ruta para eliminar una guia
router.get('/guias/eliminar/:id', verifyToken, eliminarGuia);

//Obtener parametros para las guías
router.get('/guias/parametros', obtenerParametros);

//Obtener las solicitudes de validación PROFESOR
router.get('/guias/solicitudes/prof', verifyToken, obtenerGuiasEnRevision);

//Obtener las solicitudes de validación ACADEMIA
router.get('/guias/solicitudes/acad', verifyToken, obtenerGuiasEnRevisionAcad);

//Obtener los valores del progreso de guias
router.get('/guias/progreso/info', verifyToken, obtenerInfoProgreso);

//Actualizar los valores del progreso de guias
router.put('/guias/progreso/actualizar', verifyToken, actualizarInfoProgreso);

//Rechazar guia de estudio
router.put('/guias/solicitudes/rechazar', verifyToken, rechazarGuiaAcademia);

//Aceptar solicitud de validación
router.post('/guias/solicitudes/aceptar', verifyToken, aceptarValidacion);

export default router;
