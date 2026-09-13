const AdmZip = require("adm-zip");

function normalizeText(value) {
  return String(value || "").trim();
}

function parseJsonBuffer(buffer, sourceName) {
  // Intentar multiples encodings
  const encodings = ["utf8", "utf16le", "latin1"];

  for (const encoding of encodings) {
    try {
      let text = buffer.toString(encoding);

      // Remover BOM (UTF-8 y UTF-16)
      text = text.replace(/^\uFEFF/, "").trim();

      // Intentar parse directo
      try {
        return JSON.parse(text);
      } catch {
        // Si falla, buscar primer { o [ valido
        const start = text.search(/[{[]/);
        if (start > 0) {
          return JSON.parse(text.slice(start));
        }
      }
    } catch {
      continue;
    }
  }

  // Ultimo intento: el JSON puede estar como string escapado dentro de otro JSON
  try {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
    const outer = JSON.parse(text);
    // Si hay un campo que es string con JSON adentro
    for (const val of Object.values(outer)) {
      if (typeof val === "string" && val.trim().startsWith("{")) {
        try {
          return JSON.parse(val);
        } catch {
          continue;
        }
      }
    }
  } catch {
    // ignorar, se lanza el error genérico abajo
  }

  const error = new Error(`JSON inválido: ${sourceName}`);
  error.statusCode = 400;
  throw error;
}

function extractCodigoGeneracion(json) {
  const doc = (json && json.DTE) || (json && json.dteJson) || json || {};
  return String(doc?.identificacion?.codigoGeneracion || "").trim().toUpperCase();
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

function parseDeclarante(body) {
  return {
    nit: normalizeText(body?.nit),
    nrc: normalizeText(body?.nrc),
    dui: normalizeText(body?.dui),
    nombre: normalizeText(body?.nombre),
  };
}

/**
 * Reconstruye, de forma totalmente stateless, la lista de items (JSON parseados)
 * y los archivos originales (JSON + PDF) a partir de:
 *  - files: archivos sueltos subidos (multer memoryStorage), típicamente .json / .pdf
 *  - zipFile: un único archivo .zip subido (multer memoryStorage)
 *
 * No depende de ningún estado guardado en el servidor entre requests.
 */
function collectItems({ files = [], zipFile = null }) {
  const seen = new Set();
  let duplicados = 0;
  const items = [];
  const archivosOriginales = [];
  const parseErrors = [];

  const tryAddJson = (name, buffer, mimetype) => {
    let json;
    try {
      json = parseJsonBuffer(buffer, name);
    } catch (error) {
      // No dejamos que un archivo corrupto tumbe todo el lote: lo registramos
      // como error y seguimos con el resto de archivos.
      parseErrors.push({ filename: name, razon: error.message || "JSON inválido" });
      return;
    }

    const codigo = extractCodigoGeneracion(json);

    if (codigo && seen.has(codigo)) {
      duplicados += 1;
      return;
    }

    if (codigo) {
      seen.add(codigo);
    }

    items.push({ json, filename: name });
    archivosOriginales.push({
      name,
      mimetype: mimetype || "application/json",
      size: buffer.length,
      buffer,
    });
  };

  for (const file of files) {
    const lowerName = file.originalname.toLowerCase();

    if (!lowerName.endsWith(".json")) {
      archivosOriginales.push({
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      });
      continue;
    }

    tryAddJson(file.originalname, file.buffer, file.mimetype);
  }

  if (zipFile) {
    const zip = new AdmZip(zipFile.buffer);

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) {
        continue;
      }

      const lowerName = entry.entryName.toLowerCase();
      const buffer = entry.getData();

      if (lowerName.endsWith(".json")) {
        tryAddJson(entry.entryName, buffer);
        continue;
      }

      if (lowerName.endsWith(".pdf")) {
        archivosOriginales.push({
          name: entry.entryName,
          mimetype: "application/pdf",
          size: buffer.length,
          buffer,
        });
      }
    }
  }

  return { items, archivosOriginales, duplicados, parseErrors };
}

module.exports = {
  normalizeText,
  parseJsonBuffer,
  extractCodigoGeneracion,
  buildCategorias,
  parseDeclarante,
  collectItems,
};
