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
  const startTime = Date.now();

  const logZip = (msg) => {
    const ts = new Date().toISOString();
    const elapsed = `+${Date.now() - startTime}ms`;
    const rssMB = `${Math.round(process.memoryUsage().rss / (1024 * 1024))}MB`;
    console.log(`[${ts}] [EXPORT_ZIP] [${elapsed}] [RSS: ${rssMB}] ${msg}`);
  };

  const warnZip = (msg) => {
    const ts = new Date().toISOString();
    const elapsed = `+${Date.now() - startTime}ms`;
    const rssMB = `${Math.round(process.memoryUsage().rss / (1024 * 1024))}MB`;
    console.warn(`[${ts}] [EXPORT_ZIP] [ADVERTENCIA] [${elapsed}] [RSS: ${rssMB}] ${msg}`);
  };

  const errorZip = (msg, err) => {
    const ts = new Date().toISOString();
    const elapsed = `+${Date.now() - startTime}ms`;
    const rssMB = `${Math.round(process.memoryUsage().rss / (1024 * 1024))}MB`;
    console.error(`[${ts}] [EXPORT_ZIP] [ERROR] [${elapsed}] [RSS: ${rssMB}] ${msg}`, err || "");
  };

  try {
    const { files, zipFile } = getFilesFromRequest(req);
    const totalFilesCount = files.length + (zipFile ? 1 : 0);
    const totalIncomingBytes =
      files.reduce((acc, f) => acc + (f.size || f.buffer?.length || 0), 0) +
      (zipFile ? (zipFile.size || zipFile.buffer?.length || 0) : 0);

    logZip(
      `Entrada al handler: ${files.length} archivo(s) sueltos, ` +
      `zipFile: ${zipFile ? `${zipFile.originalname} (${zipFile.size || 0} bytes)` : "ninguno"} | ` +
      `Total: ${totalFilesCount} archivo(s), ${totalIncomingBytes} bytes (~${(totalIncomingBytes / (1024 * 1024)).toFixed(2)}MB)`
    );

    const declarante = parseDeclarante(req.body);
    validateDeclarante(declarante);

    logZip("Iniciando collectItems...");
    const { items, archivosOriginales, parseErrors } = collectItems({ files, zipFile });
    logZip(
      `collectItems completado: ${items.length} items clasificados, ` +
      `${archivosOriginales.length} archivos originales (incl. PDFs), ${parseErrors.length} errores de parseo`
    );

    const resultados = mergeParseErrors(classifyMany(items, declarante), parseErrors);

    const templatePath = path.resolve(__dirname, "../templates/plantilla.xlsm");
    logZip("Iniciando generateXlsm...");
    const xlsmBuffer = await generateXlsm(resultados, templatePath);
    logZip(
      `generateXlsm completado: tamaño buffer ${xlsmBuffer.length} bytes (~${Math.round(xlsmBuffer.length / 1024)}KB)`
    );

    const categoryMap = buildCategoryMap(resultados);
    const pdfMap = buildPdfMap(archivosOriginales);
    const zipName = buildZipName(declarante);
    const xlsmName = buildXlsmName(declarante);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    let archiveCompleted = false;
    let resFinished = false;

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        warnZip(`Advertencia de archiver al generar ZIP: ${err.message}`);
      } else {
        errorZip("Error no fatal en archiver:", err);
      }
    });

    archive.on("error", (error) => {
      errorZip("Error en archiver al generar ZIP:", error);
      if (res.headersSent) {
        // Los headers ya fueron enviados; destruir la conexión para evitar ERR_HTTP_HEADERS_SENT
        res.destroy(error);
        return;
      }
      return next(error);
    });

    archive.on("end", () => {
      archiveCompleted = true;
      logZip(
        `archive 'end' emitido: ZIP generado completamente en servidor ` +
        `(${archive.pointer()} bytes comprimidos)`
      );
    });

    res.on("finish", () => {
      resFinished = true;
      logZip("res 'finish' emitido: Respuesta enviada exitosamente al cliente.");
    });

    res.on("close", () => {
      if (!archiveCompleted || !resFinished) {
        warnZip(
          `res 'close' emitido antes de completar el ZIP (archiveCompleted: ${archiveCompleted}, resFinished: ${resFinished}). ` +
          "Esto confirma que el cliente o el proxy de Render cortó la conexión antes de finalizar el stream."
        );
      } else {
        logZip("res 'close' emitido normalmente tras finalizar.");
      }

      if (!archive.destroyed) {
        archive.destroy();
      }
    });

    logZip(`Conectando archive.pipe(res) e iniciando empaquetado para ${zipName}...`);
    archive.pipe(res);

    archive.append(xlsmBuffer, { name: xlsmName });

    let appendedCount = 1; // xlsmBuffer ya incluido
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
      appendedCount++;

      const pdfFile =
        pdfMap.get(baseName) ||
        pdfMap.get(extractUuidFromName(file.name));

      if (pdfFile?.buffer) {
        archive.append(pdfFile.buffer, {
          name: `${folder}/${path.basename(pdfFile.name)}`,
        });
        appendedCount++;
      }
    }

    logZip(`Archivos agregados al ZIP: ${appendedCount}. Invocando archive.finalize()...`);
    await archive.finalize();
    logZip("archive.finalize() retornado; esperando vaciado de stream...");
  } catch (error) {
    const elapsed = `+${Date.now() - startTime}ms`;
    const rssMB = `${Math.round(process.memoryUsage().rss / (1024 * 1024))}MB`;
    console.error(`[${new Date().toISOString()}] [EXPORT_ZIP] [ERROR] [${elapsed}] [RSS: ${rssMB}] Excepción capturada en handler:`, error);
    if (res.headersSent) {
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
