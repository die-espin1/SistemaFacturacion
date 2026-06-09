const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "IVA Clasificador API running" });
});

app.listen(PORT, () => {
  console.log(`IVA Clasificador API listening on http://localhost:${PORT}`);
});
