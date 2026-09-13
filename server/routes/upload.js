// DEPRECADO: esta ruta basada en estado en memoria (sessionData) no funciona
// en entornos serverless como Vercel, donde cada request puede atender una
// instancia de función distinta sin memoria compartida.
//
// Fue reemplazada por server/routes/api.js, que procesa declarante + archivos
// en un único request stateless (POST /api/classify, /api/export/xlsm,
// /api/export/zip). Este archivo ya no se importa desde server/index.js y se
// deja solo como referencia histórica. Puedes borrarlo con seguridad.
module.exports = {};
