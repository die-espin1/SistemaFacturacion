const express = require("express");
const path = require("path");
const archiver = require("archiver");

const uploadRouter = require("./upload");
const { generateXlsm } = require("../xlsm-generator");

const router = express.Router();

function getSessionData() {
  return uploadRouter.sessionData;
}

function ensureResultados(req, res, next) {
  const sessionData = getSessionData();

  if (!sessionData?.resultados) {
    return res.status(400).json({ ok: false, error: "No hay resultados para exportar" });
  }

  return next();
}

function normalizeBaseName(filename) {
  return path.basename(String(filename || ""), path.extname(String(filename || ""))).toLowerCase();
}

function buildCategoryMap(resultados) {
  const mapping = new Map();
  const categoryFolders = {
    ANEXO_COMPRAS: "COMPRAS",
    ANEXO_CONTRIBUYENTES: "CONTRIBUYENTES",
    ANEXO_CONSUMIDOR_FINAL: "CONSUMIDOR_FINAL",
    CASILLA_162: "CASILLA_162",
  };

  for (const [categoria, folder] of Object.entries(categoryFolders)) {
    for (const item of resultados[categoria] || []) {
      mapping.set(normalizeBaseName(item.filename), folder);
    }
  }

  return mapping;
}

router.get("/download/xlsm", ensureResultados, async (_req, res, next) => {
  try {
    const sessionData = getSessionData();
    const templatePath = path.resolve(__dirname, "../templates/plantillaFinal.xlsm");
    const buffer = await generateXlsm(sessionData.resultados, templatePath);

    res.setHeader(
      "Content-Type",
      "application/vnd.ms-excel.sheet.macroEnabled.12"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantillaFinal_ABRIL2026.xlsm"'
    );

    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.get("/download/zip", ensureResultados, async (_req, res, next) => {
  try {
    const sessionData = getSessionData();
    const templatePath = path.resolve(__dirname, "../templates/plantillaFinal.xlsm");
    const xlsmBuffer = await generateXlsm(sessionData.resultados, templatePath);
    const categoryMap = buildCategoryMap(sessionData.resultados);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="IVA_ABRIL2026.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => next(error));
    archive.pipe(res);

    archive.append(xlsmBuffer, { name: "plantillaFinal_ABRIL2026.xlsm" });

    for (const file of sessionData.archivosOriginales || []) {
      const folder = categoryMap.get(normalizeBaseName(file.name));
      if (!folder || !file.buffer) {
        continue;
      }

      archive.append(file.buffer, { name: `${folder}/${path.basename(file.name)}` });
    }

    await archive.finalize();
  } catch (error) {
    return next(error);
  }
});

router.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    ok: false,
    error: error.message || "Error interno del servidor",
  });
});

module.exports = router;
