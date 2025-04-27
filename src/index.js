import express from 'express';
import {PORT}from './config.js';
import cuentaRoutes from './routes/cuenta.routes.js';
import morgan from 'morgan';
import cors from "cors";


const app = express();

// Configuración de CORS

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));  // Acepta hasta 10 MB de JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cuentaRoutes);  //Cuentas y login


app.listen(PORT);
console.log('Puerto escuchando en', PORT);


