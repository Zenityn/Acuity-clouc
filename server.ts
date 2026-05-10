import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// Import handlers
import get_ids_handler from "./api/get_ids";
import import_existing_handler from "./api/import_existing";
import update_asset_handler from "./api/update_asset";
import sync_handler from "./api/sync";
import bulk_shutdown_handler from "./api/bulk_shutdown";
import check_prices_handler from "./api/check_prices";
import create_gamepass_handler from "./api/create_gamepass";
import ping_handler from "./api/ping";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
