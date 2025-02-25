import express from 'express'

const app = express();
const port = 3000;

app.get('/', (req, res) => {
	res.send('<h1>Hola Culeros, aqui el anticristo2007</h1>')
});

app.listen(port, () => {
	console.log("Servidor en puerto 3000...")
	console.log("Estas dentro onii-chan >///<")
});


