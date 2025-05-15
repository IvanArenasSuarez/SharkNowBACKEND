import { Router } from "express";

import {
    getCuentas,
    getCuenta,
    crearCuenta,
    borrarCuenta,
    putCuenta,
    loginCuenta,
    verifyToken,
    consultarCorreo,
    actualizarContrasena,
    obtenerAcademias,
    getRecompensasDesdeDB,
    guardarAvatarConImagen, 
    obtenerAvatarSeleccion,
    obtenerImagenAvatar,   
    obtenerDatosPerfil,
    actualizarDatosPerfil,
    buscarAutores,
    buscarGuiasPorNombre,
    buscarGuiasPorMateria,
    verificarSiSigueGuia,
    obtenerDetallesGuia,
    seguirGuia,
    marcarGuiaComoMeSirve,
    quitarMeSirve,
    dejarDeSeguirGuia,
} from '../controllers/cuenta.controllers.js'

const router = Router();

//Buscar todos los usuarios
router.get("/cuenta", getCuentas);

//Devolver un usuario especifico
router.get("/cuenta/:id", getCuenta);

//Verificar si el correo existe
router.get("/verificarCorreo/:correo", consultarCorreo);

//Cambiar Contraseña
router.put("/cambiarContra", actualizarContrasena);

//Insertar usuarios
router.post("/cuenta", crearCuenta);

//Obtener Academias
router.get("/academias", obtenerAcademias);

//Borrar Cuenta
router.delete("/cuenta/:id", borrarCuenta);

//Actualiza cuenta
router.put("/cuenta/:id", putCuenta);

//Login
router.post("/login", loginCuenta);

// OBTENER RECOMPENSAS PARA EL AVATAR, GUARDAR IMAGEN, OBTENER LA SELECCION Y OBTENER IMAGEN
router.post("/avatar/opciones", getRecompensasDesdeDB);

router.post("/avatar/guardar-imagen", guardarAvatarConImagen);

router.get("/avatar/seleccion", obtenerAvatarSeleccion);

router.get("/avatar/imagen", obtenerImagenAvatar);

// OBTENER Y ACTUALIZAR LOS DATOS PARA EL PERFIL

router.get("/perfil/datos", obtenerDatosPerfil);

router.put("/perfil/actualizar", actualizarDatosPerfil);

// OBETNER USUARIOS PARA BUSQUEDA

router.get("/usuarios/autores", buscarAutores);

// OBTENER GUIAS POR NOMBRE
router.get("/guias/buscar", buscarGuiasPorNombre);

// OBTENER GUIAS POR MATERIA
router.get('/guias/buscar-por-materia', buscarGuiasPorMateria);

// VERIFICAR SI EL USUARIO SIGUE UNA GUIA
router.get("/guias/sigue", verificarSiSigueGuia);

// OBTENER DETALLES DE UNA GUIA
router.get("/guias/detalles", obtenerDetallesGuia);

// SEGUIR Y DEJAR DE SEGUIR UNA GUIA
router.post('/guias/seguir', seguirGuia);
router.delete('/guias/dejar-de-seguir', dejarDeSeguirGuia);

// DAR Y QUITAR ME SIRVE
router.put('/guias/marcar-mesirve', marcarGuiaComoMeSirve);
router.put("/guias/quitar-mesirve", quitarMeSirve);


export default router;