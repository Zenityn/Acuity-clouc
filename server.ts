import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// Import handlers
import get_ids_handler from "./api/get_ids.ts";
import import_existing_handler from "./api/import_existing.ts";
import update_asset_handler from "./api/update_asset.ts";
import sync_handler from "./api/sync.ts";
import bulk_shutdown_handler from "./api/bulk_shutdown.ts";
import check_prices_handler from "./api/check_prices.ts";
import create_gamepass_handler from "./api/create_gamepass.ts";
import ping_handler from "./api/ping.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logging Middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Middleware
  app.use((req, res, next) => {
    // Specifically handle multipart for create_gamepass (Busboy handles it)
    if (req.path === '/api/create_gamepass') {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // ─── API Routes (Delegated to /api handlers) ────────────────────────────────
  
  app.get("/api/ping", ping_handler);
  app.get("/api/get_ids", get_ids_handler);
  app.post("/api/import_existing", import_existing_handler);
  app.post("/api/check_prices", check_prices_handler);
  app.post("/api/update_asset", update_asset_handler);
  app.post("/api/sync", sync_handler);
  app.post("/api/bulk_shutdown", bulk_shutdown_handler);
  
  // Multipart handle for creation
  app.post("/api/create_gamepass", create_gamepass_handler);

  // API 404 handler
  app.use('/api', (req, res) => {
    console.error(`[API 404] ${req.method} ${req.path}`);
    res.status(404).json({ error: "API Route not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
