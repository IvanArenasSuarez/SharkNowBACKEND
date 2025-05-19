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
    obtenerGuiasDeUsuario,
    verificarJefeAcademia,
    asignarJefeAcademia,
    quitarJefeAcademia,
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

router.get("/guias/detalles", obtenerDetallesGuia);

// OBTENER GUIAS DE UN USUARIO
router.get('/guias/por-usuario', obtenerGuiasDeUsuario);

// ASIGNAR CARACTERISTCA DE ACADEMIA A UN USUARIO, VERIFICAR SI ES JEFE DE ACADEMIA Y QUITAR CARACTERISTICA
router.get('/perfil/verificar-jefe', verificarJefeAcademia);

router.put('/perfil/asignar-jefe', asignarJefeAcademia);

router.put('/perfil/quitar-jefe', quitarJefeAcademia);

export default router;
