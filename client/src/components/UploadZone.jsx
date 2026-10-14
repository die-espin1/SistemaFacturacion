import axios from 'axios'
import { useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

function buildQuickSummary(resultados) {
  const resumen = resultados?.resumen?.porCategoria || {}
  return `${resultados?.resumen?.total || 0} facturas procesadas - ${resumen.ANEXO_COMPRAS || 0} COMPRAS · ${resumen.ANEXO_CONSUMIDOR_FINAL || 0} CF · ${resumen.ANEXO_CONTRIBUYENTES || 0} CONTRIBUYENTES · ${resumen.CASILLA_162 || 0} CASILLA 162`
}

function appendDeclarante(formData, declarante) {
  formData.append('nit', declarante?.nit || '')
  formData.append('nrc', declarante?.nrc || '')
  formData.append('dui', declarante?.dui || '')
  formData.append('nombre', declarante?.nombre || '')
}

function splitFiles(list) {
  const zipFiles = []
  const files = []
  for (const file of list || []) {
    if (/\.zip$/i.test(file.name)) {
      zipFiles.push(file)
    } else {
      files.push(file)
    }
  }
  return { files, zipFiles }
}

function UploadZone({ declarante, resultados, onSuccess, onContinue }) {
  const [loading, setLoading] = useState(false)
  const [quickSummary, setQuickSummary] = useState('')
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const zipInputRef = useRef(null)

  const handleProcessed = (data, payload) => {
    onSuccess(data.resultados, payload)
    setQuickSummary(buildQuickSummary(data.resultados))
    toast.success('Facturas procesadas correctamente')

    const errorCount = data?.categorias?.ERROR || 0
    if (errorCount > 0) {
      toast(errorCount === 1 ? '1 factura no pudo clasificarse' : `${errorCount} facturas no pudieron clasificarse`, {
        icon: '⚠',
        style: { background: '#2a2400', color: '#fff', border: '1px solid #facc15' },
      })
    }
  }

  // Sube en un solo request cualquier mezcla de archivos sueltos y ZIPs.
  // Los File originales se conservan en el payload para reenviarlos al exportar.
  const uploadAll = async (list) => {
    const { files, zipFiles } = splitFiles(list)
    if (!files.length && !zipFiles.length) {
      return
    }

    const formData = new FormData()
    appendDeclarante(formData, declarante)
    files.forEach((file) => formData.append('files', file))
    zipFiles.forEach((file) => formData.append('file', file))

    setLoading(true)
    try {
      const response = await axios.post('/api/classify', formData)
      handleProcessed(response.data, { files, zipFiles })
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudieron procesar los archivos')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = async (acceptedFiles) => {
    const valid = acceptedFiles.filter((file) => /\.(json|pdf|zip)$/i.test(file.name))
    await uploadAll(valid)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    multiple: true,
  })

  const declaranteLabel = useMemo(() => {
    if (!declarante) {
      return ''
    }

    return [declarante.nombre, declarante.nit || declarante.nrc].filter(Boolean).join(' · ')
  }, [declarante])

  return (
    <div className="step-layout">
      <div className="step-heading">
        <p className="step-index">PASO 2</p>
        <h2>Carga tus documentos tributarios</h2>
        <p>{declaranteLabel}</p>
      </div>

      <div
        {...getRootProps({
          className: `upload-zone ${isDragActive ? 'is-active' : ''} ${loading ? 'is-loading' : ''}`,
        })}
      >
        <input {...getInputProps()} />
        <div className="upload-copy">
          <p className="upload-title">ARRASTRA TUS FACTURAS AQUÍ</p>
          <p className="upload-subtitle">
            Acepta: archivos .json/.pdf, carpeta completa, o uno o varios archivos .zip a la vez
          </p>
          {loading && <div className="loading-pill">PROCESANDO FACTURAS...</div>}
        </div>
      </div>

      <div className="action-grid">
        <button
          className="ghost-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          SELECCIONAR ARCHIVOS JSON
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => folderInputRef.current?.click()}
          disabled={loading}
        >
          SELECCIONAR CARPETA
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => zipInputRef.current?.click()}
          disabled={loading}
        >
          SUBIR ZIP(S)
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        multiple
        accept=".json,.pdf"
        onChange={(event) => uploadAll(Array.from(event.target.files || []))}
      />

      <input
        ref={folderInputRef}
        className="hidden-input"
        type="file"
        multiple
        onChange={(event) => uploadAll(Array.from(event.target.files || []))}
        webkitdirectory=""
        directory=""
      />

      <input
        ref={zipInputRef}
        className="hidden-input"
        type="file"
        multiple
        accept=".zip"
        onChange={(event) => uploadAll(Array.from(event.target.files || []))}
      />

      {quickSummary && (
        <div className="inline-summary">
          <p>{quickSummary}</p>
          <button className="primary-button" type="button" onClick={onContinue}>
            VER CLASIFICACIÓN →
          </button>
        </div>
      )}

      {!quickSummary && resultados && (
        <div className="inline-summary">
          <p>{buildQuickSummary(resultados)}</p>
          <button className="primary-button" type="button" onClick={onContinue}>
            VER CLASIFICACIÓN →
          </button>
        </div>
      )}
    </div>
  )
}

export default UploadZone
