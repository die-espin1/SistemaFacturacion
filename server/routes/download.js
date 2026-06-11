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

function extractUuidFromName(filename) {
  const match = String(filename || "").match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return match ? match[0].toLowerCase() : "";
}

function buildZipName(declarante) {
  const nombre = (declarante?.nombre || "DECLARANTE").trim();

  // Detectar formato "APELLIDOS, NOMBRES" (tiene coma)
  let normalized;
  if (nombre.includes(",")) {
    const [apellidos, nombres] = nombre.split(",").map((p) => p.trim());
    // Reordenar a NOMBRES_APELLIDOS
    normalized = nombres + " " + apellidos;
  } else {
    normalized = nombre;
  }

  // Limpiar: mayusculas, reemplazar espacios con _, quitar caracteres especiales
  const clean = normalized
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return `IVA_${clean}.zip`;
}

function buildXlsmName(declarante) {
  const zipName = buildZipName(declarante);
  return zipName.replace(/\.zip$/i, ".xlsm");
}

function buildCategoryMap(resultados) {
  const mapping = new Map();
  const categoryFolders = {
    ANEXO_COMPRAS: "COMPRAS",
    ANEXO_CONTRIBUYENTES: "CONTRIBUYENTES",
    ANEXO_CONSUMIDOR_FINAL: "CONSUMIDOR_FINAL",
    CASILLA_162: "CASILLA_162",
    DOCUMENTO_LIQUIDACION: "DOCUMENTO_LIQUIDACION",
    SUJETO_EXCLUIDO: "SUJETO_EXCLUIDO",
  };

  for (const [categoria, folder] of Object.entries(categoryFolders)) {
    for (const item of resultados[categoria] || []) {
      // Mapear por nombre de archivo (sin extension)
      mapping.set(normalizeBaseName(item.filename), folder);

      // Mapear tambien por codigoGeneracion (UUID del DTE)
      const codigo = item.doc?.identificacion?.codigoGeneracion;
      if (codigo) {
        mapping.set(codigo.toLowerCase(), folder);
      }
    }
  }

  return mapping;
}

function buildPdfMap(archivosOriginales) {
  const pdfMap = new Map();

  for (const file of archivosOriginales || []) {
    if (!(file?.mimetype === "application/pdf" || String(file?.name || "").toLowerCase().endsWith(".pdf"))) {
      continue;
    }

    const baseName = normalizeBaseName(file.name);
    if (baseName) {
      pdfMap.set(baseName, file);
    }

    const uuid = extractUuidFromName(file.name);
    if (uuid) {
      pdfMap.set(uuid, file);
    }
  }

  return pdfMap;
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
    const xlsmName = buildXlsmName(sessionData.declarante);
    res.setHeader("Content-Disposition", `attachment; filename="${xlsmName}"`);

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
    const pdfMap = buildPdfMap(sessionData.archivosOriginales);
    const zipName = buildZipName(sessionData.declarante);
    const xlsmName = buildXlsmName(sessionData.declarante);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => next(error));
    archive.pipe(res);

    archive.append(xlsmBuffer, { name: xlsmName });

    for (const file of sessionData.archivosOriginales || []) {
      if (String(file?.name || "").toLowerCase().endsWith(".pdf")) {
        continue;
      }

      // Intentar por nombre base primero, luego por UUID en el nombre del archivo
      const baseName = normalizeBaseName(file.name);
      const folder =
        categoryMap.get(baseName) ||
        categoryMap.get(baseName.toLowerCase()) ||
        categoryMap.get(extractUuidFromName(file.name));
      if (!folder || !file.buffer) {
        continue;
      }

      archive.append(file.buffer, { name: `${folder}/${path.basename(file.name)}` });

      const pdfFile =
        pdfMap.get(baseName) ||
        pdfMap.get(extractUuidFromName(file.name));

      if (pdfFile?.buffer) {
        archive.append(pdfFile.buffer, {
          name: `${folder}/${path.basename(pdfFile.name)}`,
        });
      }
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
