const XlsxPopulate = require("xlsx-populate");
const path = require("path");

// Mapeo de tipoDte a label
function tipoDteLabel(tipoDte) {
  const map = {
    "01": "01. FACTURA",
    "02": "02. FACTURA DE VENTA SIMPLIFICADA",
    "03": "03. COMPROBANTE DE CRÉDITO FISCAL",
    "04": "04. NOTA DE REMISIÓN",
    "05": "05. NOTA DE CRÉDITO",
    "06": "06. NOTA DE DÉBITO",
    "07": "07. COMPROBANTE DE RETENCIÓN",
    "08": "08. COMPROBANTE DE LIQUIDACIÓN",
    "11": "11. FACTURA DE EXPORTACIÓN",
    "14": "14. FACTURA DE SUJETO EXCLUIDO",
  };
  return map[tipoDte] || tipoDte;
}

// Formato de fecha como Date object para Excel
function formatDate(dateStr) {
  if (!dateStr) return null;
  // Si viene YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.split("T")[0].split("-");
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  // Si viene DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  return null;
}

function formatDateString(dateStr) {
  if (!dateStr) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

// Obtener IVA desde tributos o calcular
function getIva(resumen) {
  if (resumen?.tributos) {
    const t = resumen.tributos.find((tributo) => tributo.codigo === "20");
    if (t) return t.valor || 0;
  }
  return parseFloat(((resumen?.totalGravada || 0) * 0.13).toFixed(2));
}

async function generateXlsm(resultados, templatePath) {
  // Cargar la plantilla preservando VBA/macros
  const workbook = await XlsxPopulate.fromFileAsync(path.resolve(templatePath));

  // === ANEXO DE COMPRAS ===
  const wsCompras = workbook.sheet("ANEXO DE COMPRAS");
  let row = 3;
  for (const item of resultados.ANEXO_COMPRAS || []) {
    const r = item.resumen || item.doc?.resumen || {};
    wsCompras
      .cell(`A${row}`)
      .value(formatDate(item.doc?.identificacion?.fecEmi))
      .style("numberFormat", "dd/mm/yyyy");
    wsCompras.cell(`B${row}`).value("4. DOCUMENTO TRIBUTARIO ELECTRONICO (DTE)").style("numberFormat", "@");
    wsCompras.cell(`C${row}`).value(tipoDteLabel(item.tipoDte));
    wsCompras.cell(`D${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsCompras.cell(`E${row}`).value(item.emisor?.nit || item.emisor?.nrc || "");
    wsCompras.cell(`F${row}`).value(item.emisor?.nombre || "");
    wsCompras.cell(`G${row}`).value(r.totalExenta || 0);
    wsCompras.cell(`H${row}`).value(0);
    wsCompras.cell(`I${row}`).value(0);
    wsCompras.cell(`J${row}`).value(r.totalGravada || 0);
    wsCompras.cell(`K${row}`).value(0);
    wsCompras.cell(`L${row}`).value(0);
    wsCompras.cell(`M${row}`).value(0);
    wsCompras.cell(`N${row}`).value(getIva(r));
    wsCompras.cell(`O${row}`).value(r.montoTotalOperacion || r.totalPagar || 0);
    wsCompras.cell(`P${row}`).value("");
    wsCompras.cell(`Q${row}`).value("1 Gravada");
    wsCompras.cell(`R${row}`).value("2 Gasto");
    wsCompras.cell(`S${row}`).value("4 Servicios, Profesiones, Artes y Oficios");
    wsCompras.cell(`T${row}`).value("1 Gasto de Venta sin Donación");
    row++;
  }

  // === ANEXO CONTRIBUYENTES ===
  const wsContrib = workbook.sheet("ANEXO CONTRIBUYENTES");
  row = 3;
  for (const item of resultados.ANEXO_CONTRIBUYENTES || []) {
    const r = item.resumen || item.doc?.resumen || {};
    wsContrib
      .cell(`A${row}`)
      .value(formatDate(item.doc?.identificacion?.fecEmi))
      .style("numberFormat", "dd/mm/yyyy");
    wsContrib.cell(`B${row}`).value("4. DOCUMENTO TRIBUTARIO ELECTRONICO (DTE)").style("numberFormat", "@");
    wsContrib.cell(`C${row}`).value(tipoDteLabel(item.tipoDte));
    wsContrib.cell(`D${row}`).value("");
    wsContrib.cell(`E${row}`).value(item.doc?.identificacion?.codigoGeneracion || "");
    wsContrib.cell(`F${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsContrib.cell(`G${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsContrib.cell(`H${row}`).value(item.receptor?.nit || item.receptor?.nrc || "");
    wsContrib.cell(`I${row}`).value(item.receptor?.nombre || "");
    wsContrib.cell(`J${row}`).value(r.totalExenta || 0);
    wsContrib.cell(`K${row}`).value(r.totalNoSuj || 0);
    wsContrib.cell(`L${row}`).value(r.totalGravada || 0);
    wsContrib.cell(`M${row}`).value(getIva(r));
    wsContrib.cell(`N${row}`).value(0);
    wsContrib.cell(`O${row}`).value(0);
    wsContrib.cell(`P${row}`).value(r.montoTotalOperacion || r.totalPagar || 0);
    wsContrib.cell(`Q${row}`).value("");
    wsContrib.cell(`R${row}`).value("01 Gravada");
    wsContrib.cell(`S${row}`).value("02 Actividades de Servicios");
    row++;
  }

  // === ANEXO CONSUMIDOR FINAL ===
  const wsCf = workbook.sheet("ANEXO CONSUMIDOR FINAL");
  row = 3;
  for (const item of resultados.ANEXO_CONSUMIDOR_FINAL || []) {
    const r = item.resumen || item.doc?.resumen || {};
    wsCf
      .cell(`A${row}`)
      .value(formatDate(item.doc?.identificacion?.fecEmi))
      .style("numberFormat", "dd/mm/yyyy");
    wsCf.cell(`B${row}`).value("4. DOCUMENTO TRIBUTARIO ELECTRONICO (DTE)").style("numberFormat", "@");
    wsCf.cell(`C${row}`).value(tipoDteLabel(item.tipoDte));
    wsCf.cell(`D${row}`).value("");
    wsCf.cell(`E${row}`).value(item.doc?.identificacion?.codigoGeneracion || "");
    wsCf.cell(`F${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsCf.cell(`G${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsCf.cell(`H${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsCf.cell(`I${row}`).value(item.doc?.identificacion?.numeroControl || "");
    wsCf.cell(`J${row}`).value("");
    wsCf.cell(`K${row}`).value(r.totalExenta || 0);
    wsCf.cell(`L${row}`).value(0);
    wsCf.cell(`M${row}`).value(r.totalNoSuj || 0);
    wsCf.cell(`N${row}`).value(r.totalGravada || 0);
    wsCf.cell(`O${row}`).value(0);
    wsCf.cell(`P${row}`).value(0);
    wsCf.cell(`Q${row}`).value(0);
    wsCf.cell(`R${row}`).value(0);
    wsCf.cell(`S${row}`).value(0);
    wsCf.cell(`T${row}`).value(r.montoTotalOperacion || r.totalPagar || 0);
    wsCf.cell(`U${row}`).value("01 Gravada");
    wsCf.cell(`V${row}`).value("02 Actividades de Servicios");
    row++;
  }

  // === CASILLA 162 ===
  const ws162 = workbook.sheet("CASILLA 162");
  // Limpiar filas existentes desde row 3
  row = 3;
  while (ws162.cell(`A${row}`).value()) {
    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      ws162.cell(`${col}${row}`).value(null);
    });
    row++;
  }
  // Escribir nuevos datos
  row = 3;
  for (const item of resultados.CASILLA_162 || []) {
    const cuerpo = item.doc?.cuerpoDocumento || [];
    const numControl = item.doc?.identificacion?.numeroControl || "";
    const numCorto = numControl.split("-").pop() || numControl;
    for (const cuerpoItem of cuerpo) {
      ws162.cell(`A${row}`).value(item.emisor?.nit || "");
      ws162.cell(`B${row}`).value(formatDateString(item.doc?.identificacion?.fecEmi));
      ws162.cell(`C${row}`).value("07 COMPROBANTE DE RETENCION");
      ws162.cell(`D${row}`).value(item.doc?.identificacion?.codigoGeneracion || "");
      ws162.cell(`E${row}`).value(numCorto);
      ws162.cell(`F${row}`).value(cuerpoItem.montoSujetoGrav || 0);
      ws162.cell(`G${row}`).value(cuerpoItem.ivaRetenido || 0);
      ws162.cell(`H${row}`).value("");
      row++;
    }
  }

  // Retornar buffer
  return workbook.outputAsync();
}

module.exports = { generateXlsm };
