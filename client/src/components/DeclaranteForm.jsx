import axios from 'axios'
import { useState } from 'react'
import toast from 'react-hot-toast'

const initialForm = {
  nit: '',
  nrc: '',
  dui: '',
  nombre: '',
}

function DeclaranteForm({ onSuccess }) {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.nombre.trim()) {
      toast.error('Debes ingresar el nombre completo')
      return
    }

    if (!form.nit.trim() && !form.nrc.trim()) {
      toast.error('Debes ingresar al menos NIT o NRC')
      return
    }

    setLoading(true)

    try {
      const response = await axios.post('/api/declarante', {
        nit: form.nit.trim(),
        nrc: form.nrc.trim(),
        dui: form.dui.trim(),
        nombre: form.nombre.trim(),
      })

      onSuccess(response.data.declarante)
      toast.success('Declarante configurado')
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo guardar el declarante')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="step-layout step-layout--narrow">
      <div className="step-heading">
        <p className="step-index">PASO 1</p>
        <h2>Identifica al declarante</h2>
        <p>
          Ingresa los datos con los que vamos a detectar si cada documento corresponde a
          compras, ventas o retenciones del contribuyente.
        </p>
      </div>

      <form className="declarante-form" onSubmit={handleSubmit}>
        <label>
          <span>NIT</span>
          <input
            name="nit"
            value={form.nit}
            onChange={handleChange}
            placeholder="11211005731014"
          />
        </label>

        <label>
          <span>NRC</span>
          <input
            name="nrc"
            value={form.nrc}
            onChange={handleChange}
            placeholder="1929036"
          />
        </label>

        <label>
          <span>DUI</span>
          <input
            name="dui"
            value={form.dui}
            onChange={handleChange}
            placeholder="Opcional"
          />
        </label>

        <label className="field-span">
          <span>Nombre completo</span>
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            placeholder="IVO RAFAEL JUAREZ CESTONI"
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'GUARDANDO...' : 'CONTINUAR →'}
        </button>
      </form>

      <p className="footnote">
        Los datos ingresados se usan solo para identificar tus facturas. No se almacenan en
        ningún servidor externo.
      </p>
    </div>
  )
}

export default DeclaranteForm
