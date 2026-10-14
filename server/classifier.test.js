const path = require("path");
const assert = require("assert");
const XlsxPopulate = require("xlsx-populate");

const { classifyDocument, classifyMany, normalizeDoc } = require("./classifier");
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
  respuestaMH: { selloRecibido: " sello-ret-001 \n" },
  identificacion: { tipoDte: "07", numeroControl: "DTE-07-REC-001", codigoGeneracion: " uuid-07-rec \n", fecEmi: "2026-08-15" },
  emisor: otroContribuyente,
  receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  cuerpoDocumento: [{ montoSujetoGrav: 100, ivaRetenido: 1 }],
};
const res07Recibido = classifyDocument(dte07Recibido, declarante);
assert.strictEqual(res07Recibido.categoria, "CASILLA_162", "DTE 07 recibido debe ir a CASILLA_162");
assert.strictEqual(res07Recibido.isReceptor, true, "DTE 07 recibido debe tener isReceptor = true");
assert.strictEqual(res07Recibido.isEmisor, false, "DTE 07 recibido debe tener isEmisor = false");
assert.strictEqual(res07Recibido.doc.identificacion.selloRecibido, " sello-ret-001 \n", "Debe capturar selloRecibido desde respuestaMH");

// 1.2 Declarante es EMISOR (el declarante retuvo IVA) -> Debe ser emitido y isEmisor: true
const dte07Emitido = {
  selloRecibido: "SELLO-ROOT-07",
  identificacion: { tipoDte: "07", numeroControl: "DTE-07-EMI-001", codigoGeneracion: " uuid-07-emi \n", fecEmi: "2026-08-16" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: otroContribuyente,
  cuerpoDocumento: [{ montoSujetoGrav: 200, ivaRetenido: 2 }],
};
const res07Emitido = classifyDocument(dte07Emitido, declarante);
assert.notStrictEqual(res07Emitido.categoria, "CASILLA_162", "DTE 07 emitido NO debe ir a CASILLA_162");
assert.strictEqual(res07Emitido.isEmisor, true, "DTE 07 emitido debe tener isEmisor = true");
assert.strictEqual(res07Emitido.isReceptor, false, "DTE 07 emitido debe tener isReceptor = false");

const dte05Contribuyente = {
  identificacion: { tipoDte: "05", numeroControl: "DTE-05-EMI-001", codigoGeneracion: "UUID-05-EMI", fecEmi: "2026-08-16", selloRecibido: "SELLO-05" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: otroContribuyente,
  resumen: { totalGravada: 50, totalPagar: 56.5 },
};

// ==========================================
// 2. DTE 11 (Factura de Exportación / Liquidación)
// ==========================================
console.log("--- Probando DTE 11 (Exportación / Liquidación) ---");

// 2.1 Declarante es RECEPTOR -> Debe ser ANEXO_COMPRAS
const dte11Recibido = {
  selloRecibido: "SELLO-ROOT-11",
  identificacion: { tipoDte: "11", numeroControl: "DTE-11-REC-001", codigoGeneracion: "UUID-11-REC", fecEmi: "2026-08-17" },
  emisor: otroContribuyente,
  receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  resumen: { totalGravada: 500, totalPagar: 500 },
};
const res11Recibido = classifyDocument(dte11Recibido, declarante);
assert.strictEqual(res11Recibido.categoria, "ANEXO_COMPRAS", "DTE 11 recibido debe ir a ANEXO_COMPRAS");
assert.strictEqual(res11Recibido.isReceptor, true, "DTE 11 recibido debe tener isReceptor = true");
assert.strictEqual(res11Recibido.isEmisor, false, "DTE 11 recibido debe tener isEmisor = false");

const dte05Compra = {
  identificacion: { tipoDte: "05", numeroControl: "DTE-05-REC-001", codigoGeneracion: "UUID-05-REC", fecEmi: "2026-08-17" },
  emisor: otroContribuyente,
  receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  resumen: { totalGravada: 40, totalPagar: 45.2 },
};

// 2.2 Declarante es EMISOR -> Debe ser DOCUMENTO_LIQUIDACION
const dte11Emitido = {
  respuestaHacienda: { selloRecibido: "SELLO-HACIENDA-11" },
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
  identificacion: { tipoDte: "14", numeroControl: "", codigoGeneracion: "UUID-14-EMI", fecEmi: "2026-08-20", selloRecibido: "SELLO-ID-14" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: consumidorFinal,
  resumen: { totalCompra: 150, totalPagar: 150 },
};
const res14Emitido = classifyDocument(dte14Emitido, declarante);
assert.strictEqual(res14Emitido.categoria, "SUJETO_EXCLUIDO", "DTE 14 emitido debe ir a SUJETO_EXCLUIDO");
assert.strictEqual(res14Emitido.isEmisor, true, "DTE 14 emitido debe tener isEmisor = true");
assert.strictEqual(res14Emitido.isReceptor, false, "DTE 14 emitido debe tener isReceptor = false");

const dte01ConsumidorFinal = {
  identificacion: { tipoDte: "01", numeroControl: "DTE-01-CF-001", codigoGeneracion: "UUID-01-CF", fecEmi: "2026-08-21", selloRecibido: "SELLO-ID-01" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: consumidorFinal,
  resumen: { totalGravada: 25, totalPagar: 28.25 },
};

const dte01ConsumidorFinalSinSello = {
  identificacion: { tipoDte: "01", numeroControl: "DTE-01-CF-002", codigoGeneracion: "UUID-01-CF-2", fecEmi: "2026-08-22" },
  emisor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
  receptor: consumidorFinal,
  resumen: { totalGravada: 15, totalPagar: 16.95 },
};

// ==========================================
// 4. Verificación en Generación de XLSM
// ==========================================
console.log("--- Verificando generación de XLSM y DETALLE DE DOCUMENTOS ---");

const normalizedRoot = normalizeDoc({
  selloRecibido: "SELLO-RAIZ",
  respuestaHacienda: { selloRecibido: "SELLO-HACIENDA" },
  respuestaMH: { selloRecibido: "SELLO-MH" },
  identificacion: { selloRecibido: "SELLO-ID" },
});
assert.strictEqual(normalizedRoot.identificacion.selloRecibido, "SELLO-RAIZ", "La raíz debe tener prioridad para selloRecibido");

const normalizedHacienda = normalizeDoc({
  respuestaHacienda: { selloRecibido: "SELLO-HACIENDA" },
  respuestaMH: { selloRecibido: "SELLO-MH" },
  identificacion: { selloRecibido: "SELLO-ID" },
});
assert.strictEqual(normalizedHacienda.identificacion.selloRecibido, "SELLO-HACIENDA", "respuestaHacienda debe tener prioridad sobre respuestaMH e identificacion");

const normalizedWrapped = normalizeDoc({
  dteJson: {
    identificacion: { selloRecibido: "SELLO-ID" },
  },
  respuestaMH: { selloRecibido: "SELLO-HERMANO-MH" },
});
assert.strictEqual(normalizedWrapped.identificacion.selloRecibido, "SELLO-HERMANO-MH", "Debe capturar selloRecibido aunque respuestaMH venga como hermano de dteJson");

const normalizedDteRootSeal = normalizeDoc({
  DTE: {
    identificacion: { selloRecibido: "SELLO-ID" },
  },
  selloRecibido: "SELLO-HERMANO-RAIZ",
});
assert.strictEqual(normalizedDteRootSeal.identificacion.selloRecibido, "SELLO-HERMANO-RAIZ", "Debe capturar selloRecibido aunque venga como hermano de DTE");

const normalizedIdentificacion = normalizeDoc({
  identificacion: { selloRecibido: "SELLO-ID" },
});
assert.strictEqual(normalizedIdentificacion.identificacion.selloRecibido, "SELLO-ID", "Debe conservar selloRecibido desde identificacion");

async function testXlsmGeneration() {
  const items = [
    { json: dte07Recibido, filename: "dte07_recibido.json" },
    { json: dte07Emitido, filename: "dte07_emitido.json" },
    { json: dte05Contribuyente, filename: "dte05_contribuyente.json" },
    { json: dte11Recibido, filename: "dte11_recibido.json" },
    { json: dte05Compra, filename: "dte05_compra.json" },
    { json: dte14Recibido, filename: "dte14_recibido.json" },
    { json: dte11Emitido, filename: "dte11_emitido.json" },
    { json: dte14Emitido, filename: "dte14_emitido.json" },
    { json: dte01ConsumidorFinal, filename: "dte01_cf.json" },
    { json: dte01ConsumidorFinalSinSello, filename: "dte01_cf_sin_sello.json" },
  ];

  const resultados = classifyMany(items, declarante);

  assert.strictEqual(resultados.CASILLA_162.length, 1, "Debe haber 1 documento en CASILLA_162");
  assert.strictEqual(resultados.ANEXO_CONTRIBUYENTES.length, 2, "Debe haber 2 documentos en ANEXO_CONTRIBUYENTES");
  assert.strictEqual(resultados.ANEXO_CONSUMIDOR_FINAL.length, 2, "Debe haber 2 documentos en ANEXO_CONSUMIDOR_FINAL");
  assert.strictEqual(resultados.ANEXO_COMPRAS.length, 3, "Debe haber 3 documentos en ANEXO_COMPRAS (DTE 11, 05 y 14 recibidos)");
  assert.strictEqual(resultados.DOCUMENTO_LIQUIDACION.length, 1, "Debe haber 1 documento en DOCUMENTO_LIQUIDACION");
  assert.strictEqual(resultados.SUJETO_EXCLUIDO.length, 1, "Debe haber 1 documento en SUJETO_EXCLUIDO");

  const templatePath = path.resolve(__dirname, "templates/plantilla.xlsm");
  const buffer = await generateXlsm(resultados, templatePath);
  const workbook = await XlsxPopulate.fromDataAsync(buffer);

  assert.strictEqual(resultados.resumen.sinSello, 1, "Debe contar solo documentos sin sello que usan serie del documento");

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

  assert.strictEqual(
    detalleRows.length,
    0,
    `DETALLE DE DOCUMENTOS debe quedar vacío, pero tiene ${detalleRows.length}`
  );

  // Verificar CASILLA 162
  const ws162 = workbook.sheet("CASILLA 162");
  assert.strictEqual(ws162.cell("A3").value(), otroContribuyente.nit, "CASILLA 162 debe contener el NIT del agente retenedor");
  assert.strictEqual(ws162.cell("C3").value(), "07 COMPROBANTE DE RETENCIÓN", "CASILLA 162 debe usar el texto exacto con tilde");
  assert.strictEqual(ws162.cell("D3").value(), "SELLO-RET-001", "CASILLA 162 debe contener el sello en SERIE DEL DOCUMENTO");
  assert.strictEqual(ws162.cell("E3").value(), "DTE-07-REC-001", "CASILLA 162 debe contener el número de control completo");

  const wsContrib = workbook.sheet("ANEXO CONTRIBUYENTES");
  assert.strictEqual(wsContrib.cell("D3").value(), "UUID-07-EMI", "Contribuyentes D debe contener código de generación");
  assert.strictEqual(wsContrib.cell("E3").value(), "SELLO-ROOT-07", "Contribuyentes E debe contener sello");
  assert.strictEqual(wsContrib.cell("F3").value(), "DTE-07-EMI-001", "Contribuyentes F debe contener número de control");
  assert.strictEqual(wsContrib.cell("C4").value(), "05 NOTA DE CRÉDITO", "Contribuyentes tipo 05 debe coincidir con la lista desplegable");

  const wsCf = workbook.sheet("ANEXO CONSUMIDOR FINAL");
  assert.strictEqual(wsCf.cell("D3").value(), "UUID-01-CF", "Consumidor final D debe contener código de generación");
  assert.strictEqual(wsCf.cell("E3").value(), "SELLO-ID-01", "Consumidor final E debe contener sello");
  assert.strictEqual(wsCf.cell("H3").value(), wsCf.cell("I3").value(), "Consumidor final H debe ser igual a I");
  assert.strictEqual(wsCf.cell("H3").value(), "DTE-01-CF-001", "Consumidor final H/I deben contener el número de control cuando existe");
  assert.ok(wsCf.cell("E4").value() == null || wsCf.cell("E4").value() === "", "Consumidor final E queda vacío si falta sello");

  const wsCompras = workbook.sheet("ANEXO DE COMPRAS");
  assert.strictEqual(wsCompras.cell("C3").value(), "11. FACTURA DE EXPORTACIÓN", "Compras mantiene los textos originales con tilde");
  assert.strictEqual(wsCompras.cell("C4").value(), "05. NOTA DE CRÉDITO", "Compras tipo 05 conserva la tilde de la lista desplegable");

  console.log("¡Todas las pruebas pasaron satisfactoriamente!");
}

testXlsmGeneration()
  .then(testCombustible50)
  .catch((err) => {
    console.error("Error en la prueba de generación XLSM:", err);
    process.exit(1);
  });

// ==========================================
// 5. Combustible: 50% deducible se divide entre 2 en el Excel
// ==========================================
async function testCombustible50() {
  console.log("--- Verificando combustible 50% en ANEXO DE COMPRAS ---");
  const mk = (id, emisor, gravada) => ({
    identificacion: { tipoDte: "03", numeroControl: `N-${id}`, codigoGeneracion: `U-${id}`, fecEmi: "2026-08-15" },
    emisor,
    receptor: { nit: declarante.nit, nrc: declarante.nrc, nombre: declarante.nombre },
    resumen: {
      totalGravada: gravada,
      totalExenta: 0,
      tributos: [{ codigo: "20", valor: Number((gravada * 0.13).toFixed(2)) }],
      montoTotalOperacion: Number((gravada * 1.13).toFixed(2)),
    },
  });
  const gasolinera = { nit: "06141111111111", nrc: "111", nombre: "GASOLINERA UNO", descActividad: "Venta al por menor de combustibles" };

  const resultados = classifyMany(
    [
      { json: mk(1, gasolinera, 100), filename: "gas.json" },
      { json: mk(2, otroContribuyente, 100), filename: "ferreteria.json" },
    ],
    declarante
  );
  const buffer = await generateXlsm(resultados, path.resolve(__dirname, "templates/plantilla.xlsm"));
  const ws = (await XlsxPopulate.fromDataAsync(buffer)).sheet("ANEXO DE COMPRAS");

  // Fila 3: combustible -> mitad
  assert.strictEqual(ws.cell("J3").value(), 50, "Gravada combustible debe ser 50");
  assert.strictEqual(ws.cell("N3").value(), 6.5, "Crédito fiscal combustible debe ser 6.5");
  assert.strictEqual(ws.cell("O3").value(), 56.5, "Total combustible debe ser 56.5");
  // Fila 4: no combustible -> intacto
  assert.strictEqual(ws.cell("J4").value(), 100, "Gravada normal no se divide");
  assert.strictEqual(ws.cell("N4").value(), 13, "Crédito fiscal normal no se divide");
  assert.strictEqual(ws.cell("O4").value(), 113, "Total normal no se divide");

  console.log("¡Combustible 50% verificado en el Excel!");
}
