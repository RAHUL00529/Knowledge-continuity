// server/src/controllers/projectController.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_PATH = path.join(
  __dirname,
  "..",
  "data",
  "seed",
  "projects.json",
);

export function getProjects(req, res) {
  try {
    const data = fs.readFileSync(PROJECTS_PATH, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("getProjects failed:", err);
    res.status(500).json({ error: "Failed to load projects" });
  }
}
