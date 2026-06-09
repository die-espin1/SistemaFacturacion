const path = require("path");
const ExcelJS = require("exceljs");

const SHEET_NAMES = {
  ANEXO_COMPRAS: "ANEXO DE COMPRAS",
  ANEXO_CONTRIBUYENTES: "ANEXO CONTRIBUYENTES",
  ANEXO_CONSUMIDOR_FINAL: "ANEXO CONSUMIDOR FINAL",
  CASILLA_162: "CASILLA 162",
};

const TIPO_DTE_LABELS = {
  "01": "01. FACTURAS",
  "03": "03. COMPROBANTE DE CRÉDITO FISCAL",
  "05": "05. NOTA DE CRÉDITO",
  "07": "07. COMPROBANTE DE RETENCIÓN",
  "11": "11. FACTURA DE EXPORTACIÓN",
  "14": "14. FACTURA DE SUJETO EXCLUIDO",
};

function getWorksheet(workbook, name) {
  const worksheet = workbook.getWorksheet(name);

  if (!worksheet) {
    throw new Error(`No se encontró la hoja "${name}" en la plantilla`);
  }

  return worksheet;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }

  return text;
}

function typeDteLabel(tipoDte) {
  return TIPO_DTE_LABELS[String(tipoDte || "")] || String(tipoDte || "");
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function findIva(item) {
  const tributos = item?.doc?.resumen?.tributos;

  if (Array.isArray(tributos)) {
    const iva = tributos.find((tributo) => String(tributo?.codigo || "") === "20");
    if (iva) {
      return asNumber(iva.valor);
    }
  }

  return asNumber(item?.resumen?.totalGravada) * 0.13;
}

function findFirstEmptyRow(worksheet) {
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const value = worksheet.getRow(rowNumber).getCell(1).value;
    if (value === null || value === undefined || value === "") {
      return rowNumber;
    }
  }

  return worksheet.rowCount + 1;
}

function writeCells(worksheet, rowNumber, valuesByColumn) {
  const row = worksheet.getRow(rowNumber);

  for (const [column, value] of Object.entries(valuesByColumn)) {
    row.getCell(column).value = value;
  }

  row.commit();
}

function clearCasilla162(worksheet) {
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    for (let column = 1; column <= 8; column += 1) {
      row.getCell(column).value = null;
    }
    row.commit();
  }
}

function fillAnexoCompras(worksheet, items) {
  let rowNumber = findFirstEmptyRow(worksheet);

  for (const item of items) {
    writeCells(worksheet, rowNumber, {
      A: formatDate(item?.doc?.identificacion?.fecEmi),
      B: "2",
      C: typeDteLabel(item?.tipoDte),
      D: item?.doc?.identificacion?.numeroControl || "",
      E: item?.emisor?.nit || item?.emisor?.nrc || "",
      F: item?.emisor?.nombre || "",
      G: asNumber(item?.resumen?.totalExenta),
      H: 0,
      I: 0,
      J: asNumber(item?.resumen?.totalGravada),
      K: 0,
      L: 0,
      M: 0,
      N: findIva(item),
      O: asNumber(item?.resumen?.montoTotalOperacion || item?.resumen?.totalPagar),
      P: "",
      Q: "1 Gravada",
      R: "2 Gasto",
      S: "2 Comercio",
      T: "3 Gastos Financieros sin Donación",
    });
    rowNumber += 1;
  }
}

function fillAnexoContribuyentes(worksheet, items) {
  let rowNumber = findFirstEmptyRow(worksheet);

  for (const item of items) {
    writeCells(worksheet, rowNumber, {
      A: formatDate(item?.doc?.identificacion?.fecEmi),
      B: "1",
      C: typeDteLabel(item?.tipoDte),
      D: "",
      E: item?.doc?.identificacion?.codigoGeneracion || "",
      F: item?.doc?.identificacion?.numeroControl || "",
      G: item?.doc?.identificacion?.numeroControl || "",
      H: item?.receptor?.nit || item?.receptor?.nrc || "",
      I: item?.receptor?.nombre || "",
      J: asNumber(item?.resumen?.totalExenta),
      K: asNumber(item?.resumen?.totalNoSuj),
      L: asNumber(item?.resumen?.totalGravada),
      M: findIva(item),
      N: 0,
      O: 0,
      P: asNumber(item?.resumen?.montoTotalOperacion || item?.resumen?.totalPagar),
      Q: "",
      R: "01 Gravada",
      S: "03 Actividades Comerciales",
    });
    rowNumber += 1;
  }
}

function fillAnexoConsumidorFinal(worksheet, items) {
  let rowNumber = findFirstEmptyRow(worksheet);

  for (const item of items) {
    const numeroControl = item?.doc?.identificacion?.numeroControl || "";

    writeCells(worksheet, rowNumber, {
      A: formatDate(item?.doc?.identificacion?.fecEmi),
      B: "2",
      C: typeDteLabel(item?.tipoDte),
      D: "",
      E: item?.doc?.identificacion?.codigoGeneracion || "",
      F: numeroControl,
      G: numeroControl,
      H: numeroControl,
      I: numeroControl,
      J: "",
      K: asNumber(item?.resumen?.totalExenta),
      L: 0,
      M: asNumber(item?.resumen?.totalNoSuj),
      N: asNumber(item?.resumen?.totalGravada),
      O: 0,
      P: 0,
      Q: 0,
      R: 0,
      S: 0,
      T: asNumber(item?.resumen?.montoTotalOperacion || item?.resumen?.totalPagar),
      U: "01 Gravada",
      V: "03 Actividades Comerciales",
    });
    rowNumber += 1;
  }
}

function fillCasilla162(worksheet, items) {
  clearCasilla162(worksheet);
  let rowNumber = 3;

  for (const item of items) {
    const cuerpoDocumento = Array.isArray(item?.doc?.cuerpoDocumento)
      ? item.doc.cuerpoDocumento
      : [];

    for (const cuerpoItem of cuerpoDocumento) {
      writeCells(worksheet, rowNumber, {
        A: item?.emisor?.nit || "",
        B: formatDate(item?.doc?.identificacion?.fecEmi),
        C: "07. COMPROBANTE DE RETENCIÓN",
        D: item?.doc?.identificacion?.codigoGeneracion || "",
        E: item?.doc?.identificacion?.numeroControl || "",
        F: asNumber(cuerpoItem?.montoSujetoGrav),
        G: asNumber(cuerpoItem?.ivaRetenido),
        H: "",
      });
      rowNumber += 1;
    }
  }
}

async function generateXlsm(resultados, templatePath) {
  const workbook = new ExcelJS.Workbook();
  const fullTemplatePath = path.resolve(templatePath);

  await workbook.xlsx.readFile(fullTemplatePath);

  fillAnexoCompras(
    getWorksheet(workbook, SHEET_NAMES.ANEXO_COMPRAS),
    resultados?.ANEXO_COMPRAS || []
  );
  fillAnexoContribuyentes(
    getWorksheet(workbook, SHEET_NAMES.ANEXO_CONTRIBUYENTES),
    resultados?.ANEXO_CONTRIBUYENTES || []
  );
  fillAnexoConsumidorFinal(
    getWorksheet(workbook, SHEET_NAMES.ANEXO_CONSUMIDOR_FINAL),
    resultados?.ANEXO_CONSUMIDOR_FINAL || []
  );
  fillCasilla162(
    getWorksheet(workbook, SHEET_NAMES.CASILLA_162),
    resultados?.CASILLA_162 || []
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  generateXlsm,
  typeDteLabel,
  formatDate,
};
