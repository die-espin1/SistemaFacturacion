// DEPRECADO: dependía de sessionData en memoria (ver upload.js). Reemplazado
// por server/routes/api.js (POST /api/export/xlsm y /api/export/zip), que
// reprocesa los archivos reenviados por el cliente en cada request, sin
// estado del lado del servidor. Ya no se importa desde server/index.js.
// Puedes borrarlo con seguridad.
module.exports = {};
