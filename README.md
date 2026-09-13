# IVA Clasificador

Scaffold base para el proyecto `iva-clasificador`.

## Estructura

- `client/`: frontend React + Vite
- `server/`: backend Node.js + Express

## Scripts

- `npm run install:all`: instala dependencias en raíz, cliente y servidor
- `npm run dev`: levanta backend en `http://localhost:3001` y frontend en `http://localhost:5173`

## Requisitos de Memoria y Despliegue en Render (Ticket 7)

> [!WARNING]
> **Límite de memoria en Render Free (512 MB):**
> La plantilla `server/templates/plantilla.xlsm` tiene un tamaño descomprimido de **~71 MB** distribuidos en 22 hojas, varias de ellas con 10,000 filas pre-alocadas con fórmulas `VLOOKUP`. Al procesar este libro con `xlsx-populate`, el consumo de memoria RAM de Node.js alcanza un pico de **~1.28 GB**.
>
> En el plan **Free de Render (límite estricto de 512 MB de RAM)**, este consumo desencadena un `SIGKILL (status 137: Out of Memory)` a nivel del kernel, provocando un corte abrupto del proceso y un error **502 Bad Gateway** en el paso de exportación de ZIP/XLSM.
>
> **Soluciones:**
> 1. **Optimización de plantilla (Ticket 6A):** Limpiar filas vacías pre-alocadas con fórmulas en `plantilla.xlsm` para reducir los 71 MB de XML descomprimido a unos pocos megabytes.
> 2. **Actualización de plan:** Utilizar una instancia de Render/Railway con al menos **2 GB de RAM** mientras se use la plantilla completa actual.
