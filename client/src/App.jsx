import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import DeclaranteForm from './components/DeclaranteForm'
import UploadZone from './components/UploadZone'
import ResultsPanel from './components/ResultsPanel'
import DownloadPanel from './components/DownloadPanel'
import './App.css'

function App() {
  const [step, setStep] = useState(1)
  const [declarante, setDeclarante] = useState(null)
  const [resultados, setResultados] = useState(null)

  const handleDeclaranteSaved = (nextDeclarante) => {
    setDeclarante(nextDeclarante)
    setStep(2)
  }

  const handleUploadSuccess = (nextResultados) => {
    setResultados(nextResultados)
  }

  const resetFlow = () => {
    setStep(1)
    setDeclarante(null)
    setResultados(null)
  }

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid #fff' } }} />
      <main className="app-shell">
        <header className="app-header">
          <div className="header-copy">
            <p className="eyebrow">SISTEMA IVA - CLASIFICADOR DE FACTURAS</p>
            <h1>Control y organizacion de DTE para carga tributaria</h1>
            <p className="subtitle">Ministerio de Hacienda · El Salvador</p>
          </div>
          <ol className="stepper" aria-label="Progreso">
            {[1, 2, 3, 4].map((stepNumber) => (
              <li
                key={stepNumber}
                className={`step-chip ${step === stepNumber ? 'active' : ''} ${step > stepNumber ? 'done' : ''}`}
              >
                <span>{stepNumber}</span>
              </li>
            ))}
          </ol>
        </header>

        <section className="panel-frame">
          {step === 1 && <DeclaranteForm onSuccess={handleDeclaranteSaved} />}
          {step === 2 && (
            <UploadZone
              declarante={declarante}
              resultados={resultados}
              onSuccess={handleUploadSuccess}
              onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ResultsPanel
              resultados={resultados}
              onContinue={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <DownloadPanel
              resultados={resultados}
              onReset={resetFlow}
            />
          )}
        </section>
      </main>
    </>
  )
}

export default App
