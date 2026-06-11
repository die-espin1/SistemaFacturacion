function normalizeDoc(json) {
  const doc = (json && json.DTE) || (json && json.dteJson) || json || {};

  return {
    identificacion: doc.identificacion || {},
    emisor: doc.emisor || {},
    receptor: doc.receptor || {},
    resumen: doc.resumen || {},
    cuerpoDocumento: doc.cuerpoDocumento || [],
    extension: doc.extension || null,
    apendice: doc.apendice || null,
  };
}

function normalizeValue(value) {
  return String(value || "")
    .replace(/[\s-]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeId(value) {
  return String(value || "").replace(/\D/g, "").replace(/^0+/, "");
}

function hasValue(value) {
  return normalizeValue(value) !== "";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function matchesDeclarante(entity, fieldsToCheck, declaranteValues) {
  return fieldsToCheck.some((field) => {
    const rawValue = entity && entity[field];
    const entityValue = normalizeValue(rawValue);
    const entityId = normalizeId(rawValue);
    return (
      (entityValue !== "" && declaranteValues.includes(entityValue)) ||
      (entityId !== "" && declaranteValues.includes(entityId))
    );
  });
}

function isCombustibleIssuer(emisor) {
  const source = `${emisor?.descActividad || ""} ${emisor?.codActividad || ""}`;
  return /combustible|lubricante|gasolinera|47300/i.test(source);
}

function classifyDocument(json, declarante) {
  const doc = normalizeDoc(json);
  const { identificacion, emisor, receptor, resumen } = doc;
  const tipoDte = String(identificacion?.tipoDte || "");

  const declaranteValues = [declarante?.nit, declarante?.nrc, declarante?.dui]
    .flatMap((value) => {
      const normalizedValue = normalizeValue(value);
      const normalizedId = normalizeId(value);
      return [normalizedValue, normalizedId];
    })
    .filter(Boolean);

  const isEmisor = matchesDeclarante(emisor, ["nit", "nrc"], declaranteValues);
  const isReceptor = matchesDeclarante(
    receptor,
    ["nit", "nrc", "numDocumento"],
    declaranteValues
  );

  if (!isEmisor && !isReceptor) {
    return {
      categoria: "ERROR",
      razon: "Declarante no encontrado en el documento",
      archivo: "",
      isCombustible: false,
      montoDeducibleISR: null,
      doc,
      emisor,
      receptor,
      resumen,
      tipoDte,
    };
  }

  let categoria = "ERROR";
  let isCombustible = false;
  let montoDeducibleISR = null;

  if (tipoDte === "07") {
    categoria = "CASILLA_162";
  } else if (tipoDte === "11") {
    categoria = "DOCUMENTO_LIQUIDACION";
  } else if (tipoDte === "14") {
    categoria = "SUJETO_EXCLUIDO";
  } else if (isReceptor) {
    categoria = "ANEXO_COMPRAS";
    isCombustible = isCombustibleIssuer(emisor);

    if (isCombustible) {
      montoDeducibleISR = toNumber(resumen?.totalGravada) * 0.5;
    }
  } else if (isEmisor) {
    categoria = hasValue(receptor?.nrc)
      ? "ANEXO_CONTRIBUYENTES"
      : "ANEXO_CONSUMIDOR_FINAL";
  }

  return {
    categoria,
    isCombustible,
    montoDeducibleISR,
    doc,
    emisor,
    receptor,
    resumen,
    tipoDte,
  };
}

function classifyMany(jsonArray, declarante) {
  const grouped = {
    ANEXO_COMPRAS: [],
    ANEXO_CONTRIBUYENTES: [],
    ANEXO_CONSUMIDOR_FINAL: [],
    CASILLA_162: [],
    DOCUMENTO_LIQUIDACION: [],
    SUJETO_EXCLUIDO: [],
    ERROR: [],
  };

  for (const item of jsonArray || []) {
    const result = classifyDocument(item?.json, declarante);
    const enriched = { ...result, filename: item?.filename || "" };
    const key = grouped[result.categoria] ? result.categoria : "ERROR";
    grouped[key].push(enriched);
  }

  return {
    ...grouped,
    resumen: {
      total: (jsonArray || []).length,
      porCategoria: {
        ANEXO_COMPRAS: grouped.ANEXO_COMPRAS.length,
        ANEXO_CONTRIBUYENTES: grouped.ANEXO_CONTRIBUYENTES.length,
        ANEXO_CONSUMIDOR_FINAL: grouped.ANEXO_CONSUMIDOR_FINAL.length,
        CASILLA_162: grouped.CASILLA_162.length,
        DOCUMENTO_LIQUIDACION: grouped.DOCUMENTO_LIQUIDACION.length,
        SUJETO_EXCLUIDO: grouped.SUJETO_EXCLUIDO.length,
        ERROR: grouped.ERROR.length,
      },
    },
  };
}

module.exports = {
  normalizeDoc,
  classifyDocument,
  classifyMany,
};
