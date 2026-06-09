const fs = require("fs");
const path = require("path");
const assert = require("assert");

const { classifyDocument } = require("./classifier");

const declarante = {
  nit: "11211005731014",
  nrc: "1929036",
  dui: "",
  nombre: "IVO RAFAEL JUAREZ CESTONI",
};

const cases = [
  {
    id: "544E6A82",
    filePath:
      "C:\\Users\\diees\\Downloads\\IVA ABRIL FACTURAS\\IVA ABRIL FACTURAS\\CREDITOS FISCALES\\1\\544E6A82-26B2-6037-1387-419569384207.json",
    expectedCategoria: "ANEXO_COMPRAS",
    expectedIsCombustible: true,
  },
  {
    id: "E7AE8256",
    filePath:
      "C:\\Users\\diees\\Downloads\\IVA ABRIL FACTURAS\\IVA ABRIL FACTURAS\\FACTUTAS VENTA\\1\\E7AE8256-AB88-4171-B049-0F06ECD9ECA7.json",
    expectedCategoria: "ANEXO_CONSUMIDOR_FINAL",
    expectedIsCombustible: false,
  },
  {
    id: "50D2BB33",
    filePath:
      "C:\\Users\\diees\\Downloads\\IVA ABRIL FACTURAS\\IVA ABRIL FACTURAS\\RETENCION\\1\\50D2BB33-6326-4980-8D5E-D4870C5A55A5.json",
    expectedCategoria: "CASILLA_162",
    expectedIsCombustible: false,
  },
];

for (const testCase of cases) {
  const raw = fs.readFileSync(testCase.filePath, "utf8");
  const json = JSON.parse(raw);
  const result = classifyDocument(json, declarante);

  console.log(
    `${testCase.id}: categoria=${result.categoria}, isCombustible=${result.isCombustible}`
  );

  assert.strictEqual(
    result.categoria,
    testCase.expectedCategoria,
    `${testCase.id} categoria inesperada`
  );
  assert.strictEqual(
    result.isCombustible,
    testCase.expectedIsCombustible,
    `${testCase.id} isCombustible inesperado`
  );
}

console.log(
  `Prueba completada: ${cases.length} documentos clasificados correctamente desde ${path.resolve(__dirname)}`
);
