import bcrypt from "bcrypt";

getHash("clave123");

async function getHash(cadena) {
    const hash1 = await bcrypt.hash(cadena, 10);
    const hash2 = await bcrypt.hash(cadena, 10);

    console.log("Contraseña: ", cadena);
    console.log("Hash 1: ", hash1);
    console.log("Hash 2: ", hash2);

    const valid1 = await bcrypt.compare(cadena, hash1);
    const valid2 = await bcrypt.compare(cadena, hash2);

    console.log("¿Es el primer hash Valido?: ", valid1);
    console.log("¿Es el segundo hash Valido?: ", valid2);
}
