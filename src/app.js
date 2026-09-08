import express from "express";
import cors from "cors";
import morgan from "morgan";
import captureRoutes from "./routes/captureRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";
import projectRoutes from "./routes/projectRoutes.js"; // ADD THIS
// ...

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/capture", captureRoutes);
app.use("/api/query", queryRoutes); // ADD THIS
app.use("/api/projects", projectRoutes); // ADD THIS
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// server/src/app.js — add this AFTER all your routes, before `export default app`
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
