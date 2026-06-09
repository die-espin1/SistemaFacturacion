import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('Cargando estado del API...')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        setMessage(data.message)
        setStatus(data.status)
      } catch (error) {
        setMessage('No se pudo conectar con el backend')
        setStatus('error')
      }
    }

    loadHealth()
  }, [])

  return (
    <main className="app-shell">
      <section className="status-card">
        <h1>IVA Clasificador</h1>
        <p className="status-label">Estado del API: {status}</p>
        <p className="status-message">{message}</p>
      </section>
    </main>
  )
}

export default App
