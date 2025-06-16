import cron from "node-cron";
import { revisarProgresoYCrearNotificaciones } from "../controllers/guias.controllers.js";


export const iniciarNotificacionesCron = () => {
  cron.schedule("*/1 * * * *", revisarProgresoYCrearNotificaciones);
};