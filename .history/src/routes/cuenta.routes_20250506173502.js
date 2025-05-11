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


export default router;