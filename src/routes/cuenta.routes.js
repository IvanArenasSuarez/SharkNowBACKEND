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
    buscarAutores,
    buscarGuiasPorNombre,
    buscarGuiasPorMateria,
 
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



export default router;