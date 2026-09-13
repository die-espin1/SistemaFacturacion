const express = require("express");
const path = require("path");
const multer = require("multer");
const archiver = require("archiver");

const { classifyMany, mergeParseErrors } = require("../classifier");
const { generateXlsm } = require("../xlsm-generator");
const { parseDeclarante, collectItems, buildCategorias } = require("../lib/parsing");

const router = express.Router();

// Límite conservador: Vercel Functions rechaza cualquier request con body > 4.5MB
// (ver https://vercel.com/docs/functions/limitations). Se deja margen para el resto
// del multipart (headers, boundaries, campos de texto del declarante, etc).
const MAX_FILE_SIZE = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Un mismo endpoint acepta tanto archivos sueltos ("files") como un .zip ("file").
const uploadFields = upload.fields([
  { name: "files", maxCount: 200 },
  { name: "file", maxCount: 1 },
]);

function validateDeclarante(declarante) {
  if (!declarante.nit && !declarante.nrc) {
    const error = new Error("Debes proporcionar al menos NIT o NRC del declarante");
    error.statusCode = 400;
    throw error;
  }
}

function getFilesFromRequest(req) {
  return {
    files: req.files?.files || [],
    zipFile: req.files?.file?.[0] || null,
  };
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

// POST /api/classify
// Recibe declarante + archivos (o zip) en un único request y devuelve la
// clasificación completa. No guarda nada en el servidor: todo vive en la
// respuesta y en el estado del cliente.
router.post("/classify", uploadFields, (req, res, next) => {
  try {
    const declarante = parseDeclarante(req.body);
    validateDeclarante(declarante);

    const { files, zipFile } = getFilesFromRequest(req);
    const { items, duplicados, parseErrors } = collectItems({ files, zipFile });
    const resultados = mergeParseErrors(classifyMany(items, declarante), parseErrors);

    return res.json({
      ok: true,
      declarante,
      resultados,
      categorias: buildCategorias(resultados),
      duplicados,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/export/xlsm
// Reprocesa los mismos archivos (reenviados por el cliente) y devuelve el
// .xlsm generado directamente en la respuesta.
router.post("/export/xlsm", uploadFields, async (req, res, next) => {
  try {
    const declarante = parseDeclarante(req.body);
    validateDeclarante(declarante);

    const { files, zipFile } = getFilesFromRequest(req);
    const { items, parseErrors } = collectItems({ files, zipFile });
    const resultados = mergeParseErrors(classifyMany(items, declarante), parseErrors);

    const templatePath = path.resolve(__dirname, "../templates/plantilla.xlsm");
    const buffer = await generateXlsm(resultados, templatePath);

    const xlsmName = buildXlsmName(declarante);
    res.setHeader("Content-Type", "application/vnd.ms-excel.sheet.macroEnabled.12");
    res.setHeader("Content-Disposition", `attachment; filename="${xlsmName}"`);

    return res.send(buffer);
  } catch (error) {
    if (res.headersSent) {
      console.error("Error tras enviar headers en /export/xlsm:", error);
      res.destroy(error);
      return;
    }
    return next(error);
  }
});

// POST /api/export/zip
// Reprocesa los mismos archivos y devuelve el ZIP organizado (xlsm + DTEs
// + PDFs por carpeta) directamente en la respuesta, sin estado intermedio.
router.post("/export/zip", uploadFields, async (req, res, next) => {
  try {
    const declarante = parseDeclarante(req.body);
    validateDeclarante(declarante);

    const { files, zipFile } = getFilesFromRequest(req);
    const { items, archivosOriginales, parseErrors } = collectItems({ files, zipFile });
    const resultados = mergeParseErrors(classifyMany(items, declarante), parseErrors);

    const templatePath = path.resolve(__dirname, "../templates/plantilla.xlsm");
    const xlsmBuffer = await generateXlsm(resultados, templatePath);
    const categoryMap = buildCategoryMap(resultados);
    const pdfMap = buildPdfMap(archivosOriginales);
    const zipName = buildZipName(declarante);
    const xlsmName = buildXlsmName(declarante);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn("Advertencia de archiver al generar ZIP:", err);
      } else {
        console.error("Error no fatal en archiver:", err);
      }
    });

    archive.on("error", (error) => {
      console.error("Error en archiver al generar ZIP:", error);
      if (res.headersSent) {
        // Los headers ya fueron enviados; destruir la conexión para evitar ERR_HTTP_HEADERS_SENT
        res.destroy(error);
        return;
      }
      return next(error);
    });

    res.on("close", () => {
      if (!archive.destroyed) {
        archive.destroy();
      }
    });

    archive.pipe(res);

    archive.append(xlsmBuffer, { name: xlsmName });

    for (const file of archivosOriginales || []) {
      if (String(file?.name || "").toLowerCase().endsWith(".pdf")) {
        continue;
      }

      const baseName = normalizeBaseName(file.name);
      const folder =
        categoryMap.get(baseName) ||
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
    if (res.headersSent) {
      console.error("Error tras enviar headers en /export/zip:", error);
      res.destroy(error);
      return;
    }
    return next(error);
  }
});

router.use((error, _req, res, next) => {
  if (res.headersSent) {
    // Si los headers ya se enviaron (ej. streaming de ZIP), delegar a Express
    // para cerrar la conexión limpiamente y evitar ERR_HTTP_HEADERS_SENT.
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `Archivo demasiado grande. Máximo ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB por archivo.`
        : error.message;
    return res.status(400).json({ ok: false, error: message });
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    ok: false,
    error: error.message || "Error interno del servidor",
  });
});

module.exports = router;
