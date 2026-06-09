const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");

const { classifyMany } = require("../classifier");

const router = express.Router();

let sessionData = {
  declarante: null,
  resultados: null,
  archivosOriginales: [],
};

const filesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 50,
    fileSize: 10 * 1024 * 1024,
  },
});

const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 100 * 1024 * 1024,
  },
});

function normalizeText(value) {
  return String(value || "").trim();
}

function ensureDeclarante(req, res, next) {
  if (!sessionData.declarante) {
    return res.status(400).json({ ok: false, error: "Primero configura el declarante" });
  }

  return next();
}

function parseJsonBuffer(buffer, sourceName) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    const parseError = new Error(`JSON invalido: ${sourceName}`);
    parseError.statusCode = 400;
    throw parseError;
  }
}

function buildCategorias(resultados) {
  return {
    ANEXO_COMPRAS: resultados.ANEXO_COMPRAS.length,
    ANEXO_CONTRIBUYENTES: resultados.ANEXO_CONTRIBUYENTES.length,
    ANEXO_CONSUMIDOR_FINAL: resultados.ANEXO_CONSUMIDOR_FINAL.length,
    CASILLA_162: resultados.CASILLA_162.length,
    DOCUMENTO_LIQUIDACION: resultados.DOCUMENTO_LIQUIDACION.length,
    SUJETO_EXCLUIDO: resultados.SUJETO_EXCLUIDO.length,
    ERROR: resultados.ERROR.length,
  };
}

router.post("/declarante", (req, res) => {
  const declarante = {
    nit: normalizeText(req.body?.nit),
    nrc: normalizeText(req.body?.nrc),
    dui: normalizeText(req.body?.dui),
    nombre: normalizeText(req.body?.nombre),
  };

  if (!declarante.nit && !declarante.nrc) {
    return res.status(400).json({
      ok: false,
      error: "Debes proporcionar al menos nit o nrc",
    });
  }

  sessionData.declarante = declarante;

  return res.json({ ok: true, declarante });
});

router.get("/declarante", (_req, res) => {
  return res.json({ declarante: sessionData.declarante || null });
});

router.post(
  "/upload/files",
  ensureDeclarante,
  filesUpload.array("files", 50),
  (req, res, next) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      const jsonFiles = files.filter((file) => file.originalname.toLowerCase().endsWith(".json"));
      const items = jsonFiles.map((file) => ({
        json: parseJsonBuffer(file.buffer, file.originalname),
        filename: file.originalname,
      }));

      const resultados = classifyMany(items, sessionData.declarante);

      sessionData.resultados = resultados;
      sessionData.archivosOriginales = files.map((file) => ({
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }));

      return res.json({
        ok: true,
        resumen: resultados.resumen,
        categorias: buildCategorias(resultados),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/upload/zip",
  ensureDeclarante,
  zipUpload.single("file"),
  (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "Debes adjuntar un archivo ZIP" });
      }

      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();
      const items = [];
      const archivosOriginales = [];

      for (const entry of entries) {
        if (entry.isDirectory) {
          continue;
        }

        const entryName = entry.entryName;
        const lowerName = entryName.toLowerCase();
        const buffer = entry.getData();

        if (lowerName.endsWith(".json")) {
          items.push({
            json: parseJsonBuffer(buffer, entryName),
            filename: entryName,
          });
        }

        if (lowerName.endsWith(".pdf")) {
          archivosOriginales.push({
            name: entryName,
            size: buffer.length,
            mimetype: "application/pdf",
          });
        }
      }

      const resultados = classifyMany(items, sessionData.declarante);

      sessionData.resultados = resultados;
      sessionData.archivosOriginales = archivosOriginales;

      return res.json({
        ok: true,
        resumen: resultados.resumen,
        categorias: buildCategorias(resultados),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/resultados", (_req, res) => {
  if (!sessionData.resultados) {
    return res.json({ resultados: null });
  }

  return res.json({ resultados: sessionData.resultados });
});

router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: error.message });
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    ok: false,
    error: error.message || "Error interno del servidor",
  });
});

module.exports = router;
