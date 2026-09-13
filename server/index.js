const express = require("express");
const path = require("path");
const cors = require("cors");
const apiRouter = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3001;

// El cliente se sirve desde este mismo servidor Express (Railway/Render) o
// desde el mismo dominio via rewrites (Vercel), así que en producción las
// peticiones son same-origin. Aun así, algunos navegadores envían el header
// Origin en requests POST same-origin, y no hay datos sensibles ni sesiones
// que proteger aquí, así que reflejamos cualquier origen (equivalente a un
// CORS abierto). Si en el futuro separas cliente y API en dominios distintos,
// restringé esto con CORS_ORIGIN.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por CORS"));
    },
  })
);

app.use(express.json());
app.use("/api", apiRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "IVA Clasificador API running" });
});

// En Railway/Render (proceso persistente), servimos el cliente compilado
// (Vite build) directamente desde este mismo servidor Express, en el mismo
// dominio/puerto que la API. En dev local, el cliente se sirve aparte con
// Vite (npm run dev --prefix client) y client/dist no existe todavía, así
// que este bloque simplemente no encuentra la carpeta y no hace nada.
const clientDistPath = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDistPath));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(clientDistPath, "index.html"), (error) => {
    if (error) next();
  });
});

// Solo levantar un servidor HTTP tradicional cuando se ejecuta directamente
// (node index.js / npm run dev, o el proceso arrancado por Railway/Render).
// En Vercel, este módulo se importa y se usa como handler serverless (Express
// app = función (req, res)), sin listen().
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`IVA Clasificador API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
