import axios from 'axios'
import { useState } from 'react'
import toast from 'react-hot-toast'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function getFilenameFromResponse(response) {
  const disposition = response.headers['content-disposition']
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/)
    if (match) return match[1]
  }
  return null
}

function DownloadPanel({ resultados, onReset }) {
  const [downloadingXlsm, setDownloadingXlsm] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)

  const resumen = resultados?.resumen?.porCategoria || {}

  const handleDownloadXlsm = async () => {
    setDownloadingXlsm(true)
    try {
      const response = await axios.get('/api/download/xlsm', { responseType: 'blob' })
      const filename = getFilenameFromResponse(response) || 'plantilla.xlsm'
      triggerDownload(response.data, filename)
      toast.success('Plantilla Excel descargada')
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo descargar la plantilla Excel')
    } finally {
      setDownloadingXlsm(false)
    }
  }

  const handleDownloadZip = async () => {
    setDownloadingZip(true)
    try {
      const response = await axios.get('/api/download/zip', { responseType: 'blob' })
      const filename = getFilenameFromResponse(response) || 'IVA.zip'
      triggerDownload(response.data, filename)
      toast.success('ZIP organizado descargado')
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo descargar el ZIP')
    } finally {
      setDownloadingZip(false)
    }
  }

  return (
    <div className="step-layout">
      <div className="step-heading">
        <p className="step-index">PASO 4</p>
        <h2>CLASIFICACIÓN COMPLETADA</h2>
        <p>Total de facturas procesadas: {resultados?.resumen?.total || 0}</p>
      </div>

      <div className="summary-list">
        <div className="summary-row"><span>✓ ANEXO COMPRAS</span><strong>{resumen.ANEXO_COMPRAS || 0}</strong></div>
        <div className="summary-row"><span>✓ CONTRIBUYENTES</span><strong>{resumen.ANEXO_CONTRIBUYENTES || 0}</strong></div>
        <div className="summary-row"><span>✓ CONSUMIDOR FINAL</span><strong>{resumen.ANEXO_CONSUMIDOR_FINAL || 0}</strong></div>
        <div className="summary-row"><span>✓ CASILLA 162</span><strong>{resumen.CASILLA_162 || 0}</strong></div>
        <div className="summary-row"><span>! ERRORES</span><strong>{resumen.ERROR || 0}</strong></div>
      </div>

      <div className="download-grid">
        <button className="download-card" type="button" onClick={handleDownloadXlsm} disabled={downloadingXlsm}>
          <span className="download-title">⬇ DESCARGAR PLANTILLA EXCEL</span>
          <span className="download-caption">
            {downloadingXlsm ? 'PREPARANDO DESCARGA...' : 'Archivo listo para subir al portal de Hacienda'}
          </span>
        </button>

        <button className="download-card" type="button" onClick={handleDownloadZip} disabled={downloadingZip}>
          <span className="download-title">⬇ DESCARGAR ZIP ORGANIZADO</span>
          <span className="download-caption">
            {downloadingZip ? 'PREPARANDO DESCARGA...' : 'Incluye facturas organizadas por carpeta + plantilla Excel'}
          </span>
        </button>
      </div>

      <div className="footer-actions">
        <button className="ghost-button" type="button" onClick={onReset}>
          ← VOLVER A CLASIFICAR
        </button>
      </div>
    </div>
  )
}

export default DownloadPanel
