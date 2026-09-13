// Entrypoint de Vercel: toda request a /api/* llega aquí (ver rewrites en
// vercel.json) y se delega al Express app completo. Express apps son
// funciones (req, res), compatibles directamente con el runtime Node.js de
// Vercel Functions.
module.exports = require("../server/index.js");
