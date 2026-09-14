const path = require("path");
const assert = require("assert");
const XlsxPopulate = require("xlsx-populate");

const { classifyDocument, classifyMany } = require("./classifier");
const { generateXlsm } = require("./xlsm-generator");

const declarante = {
  nit: "06140709821308",
  nrc: "2551117",
  dui: "018144559",
  nombre: "IVONNE CAROLINA GONZALEZ GALLARDO",
};

const otroContribuyente = {
  nit: "06141402560013",
  nrc: "92312",
  nombre: "FERRETERIA LA PALMA S.A. DE C.V.",
};

const consumidorFinal = {
  nit: "",
  nrc: "",
  numDocumento: "034567891",
  nombre: "JUAN PEREZ",
};

// ==========================================
// 1. DTE 07 (Comprobante de Retención)
// ==========================================
console.log("--- Probando DTE 07 (Retención) ---");

// 1.1 Declarante es RECEPTOR (le retuvieron IVA) -> Debe ser CASILLA_162 y isReceptor: true
const dte07Recibido = {
  identificacion: { tipoDte: "07", numeroControl: "DTE-07-REC-001", codigoGeneracion: "UUID-07-REC", fecEmi: "2026-08-15" },
  emisor: otroContribuyente,
  receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  cuerpoDocumento: [{ montoSujetoGrav: 100, ivaRetenido: 1 }],
};
const res07Recibido = classifyDocument(dte07Recibido, declarante);
assert.strictEqual(res07Recibido.categoria, "CASILLA_162", "DTE 07 recibido debe ir a CASILLA_162");
assert.strictEqual(res07Recibido.isReceptor, true, "DTE 07 recibido debe tener isReceptor = true");
assert.strictEqual(res07Recibido.isEmisor, false, "DTE 07 recibido debe tener isEmisor = false");

// 1.2 Declarante es EMISOR (el declarante retuvo IVA) -> Debe ser emitido y isEmisor: true
const dte07Emitido = {
  identificacion: { tipoDte: "07", numeroControl: "DTE-07-EMI-001", codigoGeneracion: "UUID-07-EMI", fecEmi: "2026-08-16" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: otroContribuyente,
  cuerpoDocumento: [{ montoSujetoGrav: 200, ivaRetenido: 2 }],
};
const res07Emitido = classifyDocument(dte07Emitido, declarante);
assert.notStrictEqual(res07Emitido.categoria, "CASILLA_162", "DTE 07 emitido NO debe ir a CASILLA_162");
assert.strictEqual(res07Emitido.isEmisor, true, "DTE 07 emitido debe tener isEmisor = true");
assert.strictEqual(res07Emitido.isReceptor, false, "DTE 07 emitido debe tener isReceptor = false");

// ==========================================
// 2. DTE 11 (Factura de Exportación / Liquidación)
// ==========================================
console.log("--- Probando DTE 11 (Exportación / Liquidación) ---");

// 2.1 Declarante es RECEPTOR -> Debe ser ANEXO_COMPRAS
const dte11Recibido = {
  identificacion: { tipoDte: "11", numeroControl: "DTE-11-REC-001", codigoGeneracion: "UUID-11-REC", fecEmi: "2026-08-17" },
  emisor: otroContribuyente,
  receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  resumen: { totalGravada: 500, totalPagar: 500 },
};
const res11Recibido = classifyDocument(dte11Recibido, declarante);
assert.strictEqual(res11Recibido.categoria, "ANEXO_COMPRAS", "DTE 11 recibido debe ir a ANEXO_COMPRAS");
assert.strictEqual(res11Recibido.isReceptor, true, "DTE 11 recibido debe tener isReceptor = true");
assert.strictEqual(res11Recibido.isEmisor, false, "DTE 11 recibido debe tener isEmisor = false");

// 2.2 Declarante es EMISOR -> Debe ser DOCUMENTO_LIQUIDACION
const dte11Emitido = {
  identificacion: { tipoDte: "11", numeroControl: "DTE-11-EMI-001", codigoGeneracion: "UUID-11-EMI", fecEmi: "2026-08-18" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: otroContribuyente,
  resumen: { totalGravada: 1000, totalPagar: 1000 },
};
const res11Emitido = classifyDocument(dte11Emitido, declarante);
assert.strictEqual(res11Emitido.categoria, "DOCUMENTO_LIQUIDACION", "DTE 11 emitido debe ir a DOCUMENTO_LIQUIDACION");
assert.strictEqual(res11Emitido.isEmisor, true, "DTE 11 emitido debe tener isEmisor = true");
assert.strictEqual(res11Emitido.isReceptor, false, "DTE 11 emitido debe tener isReceptor = false");

// ==========================================
// 3. DTE 14 (Factura de Sujeto Excluido)
// ==========================================
console.log("--- Probando DTE 14 (Sujeto Excluido) ---");

// 3.1 Declarante es RECEPTOR -> Debe ser ANEXO_COMPRAS
const dte14Recibido = {
  identificacion: { tipoDte: "14", numeroControl: "DTE-14-REC-001", codigoGeneracion: "UUID-14-REC", fecEmi: "2026-08-19" },
  emisor: otroContribuyente,
  receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  resumen: { totalCompra: 75, totalPagar: 75 },
};
const res14Recibido = classifyDocument(dte14Recibido, declarante);
assert.strictEqual(res14Recibido.categoria, "ANEXO_COMPRAS", "DTE 14 recibido debe ir a ANEXO_COMPRAS");
assert.strictEqual(res14Recibido.isReceptor, true, "DTE 14 recibido debe tener isReceptor = true");
assert.strictEqual(res14Recibido.isEmisor, false, "DTE 14 recibido debe tener isEmisor = false");

// 3.2 Declarante es EMISOR -> Debe ser SUJETO_EXCLUIDO
const dte14Emitido = {
  identificacion: { tipoDte: "14", numeroControl: "DTE-14-EMI-001", codigoGeneracion: "UUID-14-EMI", fecEmi: "2026-08-20" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: consumidorFinal,
  resumen: { totalCompra: 150, totalPagar: 150 },
};
const res14Emitido = classifyDocument(dte14Emitido, declarante);
assert.strictEqual(res14Emitido.categoria, "SUJETO_EXCLUIDO", "DTE 14 emitido debe ir a SUJETO_EXCLUIDO");
assert.strictEqual(res14Emitido.isEmisor, true, "DTE 14 emitido debe tener isEmisor = true");
assert.strictEqual(res14Emitido.isReceptor, false, "DTE 14 emitido debe tener isReceptor = false");

// ==========================================
// 4. Verificación en Generación de XLSM
// ==========================================
console.log("--- Verificando generación de XLSM y DETALLE DE DOCUMENTOS ---");

async function testXlsmGeneration() {
  const items = [
    { json: dte07Recibido, filename: "dte07_recibido.json" },
    { json: dte11Recibido, filename: "dte11_recibido.json" },
    { json: dte14Recibido, filename: "dte14_recibido.json" },
    { json: dte11Emitido, filename: "dte11_emitido.json" },
    { json: dte14Emitido, filename: "dte14_emitido.json" },
  ];

  const resultados = classifyMany(items, declarante);

  assert.strictEqual(resultados.CASILLA_162.length, 1, "Debe haber 1 documento en CASILLA_162");
  assert.strictEqual(resultados.ANEXO_COMPRAS.length, 2, "Debe haber 2 documentos en ANEXO_COMPRAS (DTE 11 y 14 recibidos)");
  assert.strictEqual(resultados.DOCUMENTO_LIQUIDACION.length, 1, "Debe haber 1 documento en DOCUMENTO_LIQUIDACION");
  assert.strictEqual(resultados.SUJETO_EXCLUIDO.length, 1, "Debe haber 1 documento en SUJETO_EXCLUIDO");

  const templatePath = path.resolve(__dirname, "templates/plantilla.xlsm");
  const buffer = await generateXlsm(resultados, templatePath);
  const workbook = await XlsxPopulate.fromDataAsync(buffer);

  // Verificar DETALLE DE DOCUMENTOS
  const wsDetalle = workbook.sheet("DETALLE DE DOCUMENTOS");
  const detalleRows = [];
  let r = 3;
  while (wsDetalle.cell(`A${r}`).value() || wsDetalle.cell(`G${r}`).value()) {
    detalleRows.push({
      numControl: wsDetalle.cell(`A${r}`).value(),
      clase: wsDetalle.cell(`B${r}`).value(),
      tipoDoc: wsDetalle.cell(`E${r}`).value(),
      tipoDetalle: wsDetalle.cell(`F${r}`).value(),
      codigoGen: wsDetalle.cell(`G${r}`).value(),
    });
    r++;
  }

  console.log(`Filas generadas en DETALLE DE DOCUMENTOS: ${detalleRows.length}`);
  detalleRows.forEach((row, i) => console.log(` Fila ${i + 3}:`, JSON.stringify(row)));

  // Debe contener únicamente los 2 documentos EMITIDOS (dte11Emitido y dte14Emitido)
  assert.strictEqual(
    detalleRows.length,
    2,
    `DETALLE DE DOCUMENTOS debe tener exactamente 2 filas emitidas, pero tiene ${detalleRows.length}`
  );

  const codigos = detalleRows.map((d) => d.codigoGen);
  assert.ok(codigos.includes("UUID-11-EMI"), "Debe incluir UUID-11-EMI");
  assert.ok(codigos.includes("UUID-14-EMI"), "Debe incluir UUID-14-EMI");
  assert.ok(!codigos.includes("UUID-07-REC"), "NO debe incluir UUID-07-REC");
  assert.ok(!codigos.includes("UUID-11-REC"), "NO debe incluir UUID-11-REC");
  assert.ok(!codigos.includes("UUID-14-REC"), "NO debe incluir UUID-14-REC");

  // Verificar CASILLA 162
  const ws162 = workbook.sheet("CASILLA 162");
  assert.strictEqual(ws162.cell("A3").value(), otroContribuyente.nit, "CASILLA 162 debe contener el NIT del agente retenedor");
  assert.strictEqual(ws162.cell("D3").value(), "UUID-07-REC", "CASILLA 162 debe contener el código de generación del DTE 07");

  console.log("¡Todas las pruebas pasaron satisfactoriamente!");
}

testXlsmGeneration().catch((err) => {
  console.error("Error en la prueba de generación XLSM:", err);
  process.exit(1);
});
