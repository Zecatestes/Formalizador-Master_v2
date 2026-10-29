import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const python = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(",").map((value) => value.trim()) : true,
}));
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "odeen-vehicle-lookup" }));

app.post("/api/scrape", (req, res) => {
  const body = req.body;
  if (!body || typeof body.url !== "string" || !Array.isArray(body.fields) || body.fields.length === 0) {
    res.status(400).json({ error: "Informe uma URL e pelo menos um campo para extração." });
    return;
  }

  const child = spawn(python, [path.join(here, "scraper.py")], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", () => {
    if (!res.headersSent) res.status(500).json({ error: "Não foi possível iniciar o Python. Instale Python e as dependências de requirements.txt." });
  });
  child.on("close", (code) => {
    if (res.headersSent) return;
    try {
      const result = JSON.parse(stdout);
      if (code !== 0 || !result.ok || !result.data) {
        res.status(result.status || 502).json({ error: result.error || stderr.trim() || "A consulta não foi concluída." });
        return;
      }
      res.json(result.data);
    } catch {
      res.status(502).json({ error: "O serviço de consulta retornou uma resposta inválida." });
    }
  });
  child.stdin.end(JSON.stringify({
    url: body.url,
    fields: body.fields,
    itemSelector: body.itemSelector ?? null,
  }));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`ODEEN vehicle lookup API running on port ${port}`);
});
