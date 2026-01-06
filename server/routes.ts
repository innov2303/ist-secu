import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize seed data
  await storage.seed();

  app.get(api.scripts.list.path, async (req, res) => {
    const scripts = await storage.getScripts();
    res.json(scripts);
  });

  app.get(api.scripts.download.path, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const script = await storage.getScript(id);
    if (!script) {
      return res.status(404).json({ message: "Script not found" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${script.filename}"`);
    res.setHeader("Content-Type", "text/plain");
    res.send(script.content);
  });

  return httpServer;
}
