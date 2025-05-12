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


export default router;