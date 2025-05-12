import { Router } from "express";

import { 
    getCuentas,
    getCuenta,
    crearCuenta,
    borrarCuenta,
    putCuenta,
    loginCuenta,
    verifyToken,
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


export default router;