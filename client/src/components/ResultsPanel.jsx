import { useMemo, useState } from 'react'

const tabs = [
  { key: 'ANEXO_COMPRAS', label: 'COMPRAS' },
  { key: 'ANEXO_CONTRIBUYENTES', label: 'CONTRIBUYENTES' },
  { key: 'ANEXO_CONSUMIDOR_FINAL', label: 'CONSUMIDOR FINAL' },
  { key: 'CASILLA_162', label: 'CASILLA 162' },
  { key: 'ERROR', label: 'ERRORES' },
]

function formatNumber(value) {
  const number = Number(value || 0)
  return number.toLocaleString('es-SV', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function ResultsPanel({ resultados, onContinue }) {
  const [activeTab, setActiveTab] = useState('ANEXO_COMPRAS')

  const counts = useMemo(
    () => ({
      ANEXO_COMPRAS: resultados?.ANEXO_COMPRAS?.length || 0,
      ANEXO_CONTRIBUYENTES: resultados?.ANEXO_CONTRIBUYENTES?.length || 0,
      ANEXO_CONSUMIDOR_FINAL: resultados?.ANEXO_CONSUMIDOR_FINAL?.length || 0,
      CASILLA_162: resultados?.CASILLA_162?.length || 0,
      ERROR: resultados?.ERROR?.length || 0,
    }),
    [resultados]
  )

  const renderTable = () => {
    if (!resultados) {
      return <p className="empty-state">Sin resultados para mostrar</p>
    }

    if (activeTab === 'ANEXO_COMPRAS') {
      const rows = resultados.ANEXO_COMPRAS || []
      if (!rows.length) {
        return <p className="empty-state">Sin registros en esta categoría</p>
      }

      return (
        <table className="results-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>NIT</th>
              <th>Total</th>
              <th>IVA</th>
              <th>¿Combustible?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.filename} className={item.isCombustible ? 'row-highlight' : ''}>
                <td>{item.doc?.identificacion?.fecEmi}</td>
                <td>{item.emisor?.nombre}</td>
                <td>{item.emisor?.nit || item.emisor?.nrc}</td>
                <td>{formatNumber(item.resumen?.montoTotalOperacion || item.resumen?.totalPagar)}</td>
                <td>{formatNumber(item.montoDeducibleISR ? item.resumen?.tributos?.find?.((tributo) => tributo.codigo === '20')?.valor || item.resumen?.totalGravada * 0.13 : item.resumen?.tributos?.find?.((tributo) => tributo.codigo === '20')?.valor || item.resumen?.totalGravada * 0.13)}</td>
                <td>
                  {item.isCombustible ? (
                    <span className="status-badge status-badge--fuel">50% DEDUCIBLE</span>
                  ) : (
                    'No'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (activeTab === 'ANEXO_CONTRIBUYENTES') {
      const rows = resultados.ANEXO_CONTRIBUYENTES || []
      if (!rows.length) {
        return <p className="empty-state">Sin registros en esta categoría</p>
      }

      return (
        <table className="results-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>NIT/NRC</th>
              <th>Gravadas</th>
              <th>Débito Fiscal</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.filename}>
                <td>{item.doc?.identificacion?.fecEmi}</td>
                <td>{item.receptor?.nombre}</td>
                <td>{item.receptor?.nit || item.receptor?.nrc}</td>
                <td>{formatNumber(item.resumen?.totalGravada)}</td>
                <td>{formatNumber(item.resumen?.totalGravada * 0.13)}</td>
                <td>{formatNumber(item.resumen?.montoTotalOperacion || item.resumen?.totalPagar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (activeTab === 'ANEXO_CONSUMIDOR_FINAL') {
      const rows = resultados.ANEXO_CONSUMIDOR_FINAL || []
      if (!rows.length) {
        return <p className="empty-state">Sin registros en esta categoría</p>
      }

      return (
        <table className="results-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>N° Control</th>
              <th>Gravadas</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.filename}>
                <td>{item.doc?.identificacion?.fecEmi}</td>
                <td>{item.doc?.identificacion?.numeroControl}</td>
                <td>{formatNumber(item.resumen?.totalGravada)}</td>
                <td>{formatNumber(item.resumen?.montoTotalOperacion || item.resumen?.totalPagar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (activeTab === 'CASILLA_162') {
      const rows = resultados.CASILLA_162 || []
      if (!rows.length) {
        return <p className="empty-state">Sin registros en esta categoría</p>
      }

      return (
        <table className="results-table">
          <thead>
            <tr>
              <th>NIT Agente</th>
              <th>Fecha</th>
              <th>N° Documento</th>
              <th>Monto Sujeto</th>
              <th>IVA Retenido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) =>
              (item.doc?.cuerpoDocumento || []).map((cuerpoItem, index) => (
                <tr key={`${item.filename}-${index}`}>
                  <td>{item.emisor?.nit}</td>
                  <td>{item.doc?.identificacion?.fecEmi}</td>
                  <td>{item.doc?.identificacion?.numeroControl}</td>
                  <td>{formatNumber(cuerpoItem.montoSujetoGrav)}</td>
                  <td>{formatNumber(cuerpoItem.ivaRetenido)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )
    }

    const rows = resultados.ERROR || []
    if (!rows.length) {
      return <p className="empty-state">Sin registros en esta categoría</p>
    }

    return (
      <table className="results-table">
        <thead>
          <tr>
            <th>Archivo</th>
            <th>Razón del error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${item.filename || item.archivo || 'error'}-${index}`} className="row-error">
              <td>{item.filename || item.archivo || 'Sin nombre'}</td>
              <td>{item.razon || 'Error desconocido'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="step-layout">
      <div className="step-heading">
        <p className="step-index">PASO 3</p>
        <h2>Revisa la clasificación detectada</h2>
        <p>Confirma en qué anexo quedó cada documento antes de descargar la plantilla final.</p>
      </div>

      <div className="tab-strip">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            <strong>{counts[tab.key]}</strong>
          </button>
        ))}
      </div>

      <div className="table-shell">{renderTable()}</div>

      <div className="footer-actions">
        <button className="primary-button" type="button" onClick={onContinue}>
          DESCARGAR ARCHIVOS →
        </button>
      </div>
    </div>
  )
}

export default ResultsPanel
