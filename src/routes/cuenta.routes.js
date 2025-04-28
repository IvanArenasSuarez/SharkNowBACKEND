import { Router } from "express";


import { 
    getCuentas,
    getCuenta,
    crearCuenta,
    borrarCuenta,
    putCuenta,
    loginCuenta,
    verifyToken,
    getRecompensasDesdeDB,
    guardarAvatarConImagen, 
    obtenerAvatarSeleccion,
    obtenerImagenAvatar,   
    obtenerDatosPerfil,
    actualizarDatosPerfil,
 
} from '../controllers/cuenta.controllers.js'

const router = Router();

//Buscar todos los usuarios
router.get("/cuenta", getCuentas);

//Devolver un usuario especifico
router.get("/cuenta/:id", getCuenta);

//Insertar usuarios
router.post("/cuenta", crearCuenta);

//Borrar Cuenta
router.delete("/cuenta/:id", borrarCuenta);

//Actualiza cuenta
router.put("/cuenta/:id", putCuenta);

//Login
router.post("/login", loginCuenta);

// Obtener recompensas para el avatar
router.post("/avatar/opciones", getRecompensasDesdeDB);

router.post("/avatar/guardar-imagen", guardarAvatarConImagen);

router.get("/avatar/seleccion", obtenerAvatarSeleccion);

router.get("/avatar/imagen", obtenerImagenAvatar);

router.get("/perfil/datos", obtenerDatosPerfil);

router.put("/perfil/actualizar", actualizarDatosPerfil);

export default router;