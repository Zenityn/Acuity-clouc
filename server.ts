import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

const LOTS_FILE = path.join(__dirname, "active_lots.json");

// Helper to load/save tracked lot IDs
function loadLots(): any[] {
  try {
    if (fs.existsSync(LOTS_FILE)) {
      return JSON.parse(fs.readFileSync(LOTS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading lots:", e);
  }
  return [];
}

function saveLots(lots: any[]) {
  fs.writeFileSync(LOTS_FILE, JSON.stringify(lots, null, 2));
}

export const app = express();
const PORT = 3000;

app.use(express.json());

// ─── Roblox API Proxy Helpers ──────────────────────────────────────────────

  const getHeaders = (apiKey: string) => ({
    "x-api-key": apiKey,
  });

  // ─── API Routes ─────────────────────────────────────────────────────────────

  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/get_ids", (req, res) => {
    res.json({ lots: loadLots() });
  });

  // LIST: Get all gamepasses from Roblox
  app.post("/import_existing", async (req, res) => {
    const { filterName, universeId, apiKey } = req.body;
    if (!universeId || !apiKey) return res.status(400).json({ error: "Missing credentials" });

    try {
      const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`;
      const response = await fetch(url, { headers: getHeaders(apiKey) });
      const data: any = await response.json();

      if (!response.ok) throw new Error(data.message || "Roblox API error");

      const allPasses = data.gamePasses || [];
      const matched = filterName 
        ? allPasses.filter((p: any) => p.name.toLowerCase().includes(filterName.toLowerCase()))
        : allPasses;

      const existing = loadLots();
      const existingIds = new Set(existing.map(l => l.id));

      const newLots = matched
        .filter((p: any) => !existingIds.has(String(p.gamePassId)))
        .map((p: any, i: number) => ({
          id: String(p.gamePassId),
          baseName: "Imported",
          num: existing.length + i + 1,
          universeId: universeId,
          name: p.name,
          price: p.priceInformation?.defaultPriceInRobux || 0,
          isForSale: !!p.priceInformation?.defaultPriceInRobux
        }));

      const updated = [...existing, ...newLots];
      saveLots(updated);

      res.json({ status: "success", count: newLots.length });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // CREATE: New gamepass
  app.post("/api/create_gamepass", upload.single('imageFile'), async (req, res) => {
    const { name, description, price, isForSale, universeId, apiKey, baseName } = req.body;
    const file = req.file;

    if (!name || !universeId || !apiKey || !file) {
      return res.status(400).json({ error: "Missing required creation data (name, universeId, apiKey, or icon)" });
    }

    try {
      const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`;
      
      const form = new FormData();
      // Match the Python snippet's field names exactly
      form.append("name", name);
      form.append("description", description || "Created via BloxEx Cloud Manager");
      form.append("price", String(price || 0));
      form.append("isForSale", String(isForSale === 'true' || isForSale === true));
      
      // The imageFile must be appended last or with proper headers
      form.append("imageFile", file.buffer, {
        filename: file.originalname || 'icon.jpg',
        contentType: file.mimetype || 'image/jpeg',
      });

      console.log(`[Gamepass Creation] Calling Roblox API: ${url}`);
      
      const r = await fetch(url, {
        method: "POST",
        headers: { 
          ...getHeaders(apiKey), 
          ...form.getHeaders() 
        },
        body: form
      });

      const responseText = await r.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText };
      }

      if (!r.ok) {
        console.error("Roblox API Error:", responseText);
        // Extract a better error message if possible
        const errorMessage = data.message || (data.errors && data.errors[0]?.message) || `Roblox Error ${r.status}`;
        throw new Error(errorMessage);
      }

      // Track the new gamepass
      const existing = loadLots();
      const newLot = {
        id: String(data.gamePassId),
        baseName: baseName || "Inventory",
        num: existing.length + 1,
        universeId: universeId,
        name: name,
        price: Number(price || 0),
        isForSale: isForSale === 'true' || isForSale === true
      };
      saveLots([...existing, newLot]);

      res.json({ status: "success", gamePassId: data.gamePassId });
    } catch (e: any) {
      console.error("Creation failed:", e);
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // GET: Audit prices for universe
  app.post("/check_prices", async (req, res) => {
    const { universeId, apiKey } = req.body;
    const lots = loadLots().filter(l => l.universeId === universeId);
    
    const results = [];
    for (const lot of lots) {
      try {
        const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${lot.id}`;
        const r = await fetch(url, { headers: getHeaders(apiKey) });
        const data: any = await r.json();
        
        if (r.ok) {
          lot.price = data.priceInformation?.defaultPriceInRobux || 0;
          lot.isForSale = !!data.priceInformation?.defaultPriceInRobux;
          results.push({ id: lot.id, price: lot.price, isForSale: lot.isForSale });
        }
      } catch (e) {
        console.error(`Audit failed for ${lot.id}:`, e);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    saveLots(loadLots().map(l => {
      const found = results.find(res => res.id === l.id);
      return found ? { ...l, ...found } : l;
    }));

    res.json({ status: "success", audited: results.length });
  });

  // PATCH: Update asset details (name, group, price, sale status)
  app.post("/update_asset", async (req, res) => {
    const { id, universeId, apiKey, name, baseName, price, forSale, description } = req.body;
    if (!id || !universeId || !apiKey) return res.status(400).json({ error: "Missing info" });

    try {
      const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${id}`;
      
      const form = new FormData();
      if (name !== undefined) form.append("name", String(name));
      if (baseName !== undefined) form.append("description", `[Group: ${baseName}] ${description || ""}`); // Optional: track group in description if needed, or just update local cache
      if (price !== undefined) form.append("price", String(price));
      if (forSale !== undefined) form.append("isForSale", String(forSale));

      const r = await fetch(url, {
        method: "PATCH",
        headers: { ...getHeaders(apiKey), ...form.getHeaders() },
        body: form
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Roblox Error ${r.status}: ${txt}`);
      }

      // Update local cache
      const lots = loadLots();
      const idx = lots.findIndex(l => l.id === id);
      if (idx !== -1) {
        if (name !== undefined) lots[idx].name = name;
        if (baseName !== undefined) lots[idx].baseName = baseName;
        if (price !== undefined) lots[idx].price = price;
        if (forSale !== undefined) lots[idx].isForSale = forSale;
        saveLots(lots);
      }

      res.json({ status: "success" });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // BULK SYNC
  app.post("/sync", async (req, res) => {
    const { universeId, apiKey, price } = req.body;
    const lots = loadLots().filter(l => l.universeId === universeId);
    
    let success = 0;
    for (const lot of lots) {
      try {
        const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${lot.id}`;
        const form = new FormData();
        form.append("price", String(price));
        form.append("isForSale", "true");

        const r = await fetch(url, {
          method: "PATCH",
          headers: { ...getHeaders(apiKey), ...form.getHeaders() },
          body: form
        });

        if (r.ok) success++;
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(e);
      }
    }

    const all = loadLots();
    const updated = all.map(l => (l.universeId === universeId) ? { ...l, price, isForSale: true } : l);
    saveLots(updated);

    res.json({ status: "success", count: success });
  });

  // BULK SHUTDOWN
  app.post("/bulk_shutdown", async (req, res) => {
    const { universeId, apiKey, ids } = req.body;
    if (!universeId || !apiKey || !ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: "Missing required information" });
    }

    let success = 0;
    for (const id of ids) {
      try {
        const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${id}`;
        const form = new FormData();
        form.append("isForSale", "false");

        const r = await fetch(url, {
          method: "PATCH",
          headers: { ...getHeaders(apiKey), ...form.getHeaders() },
          body: form
        });

        if (r.ok) success++;
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.error(`Shutdown failed for ${id}:`, e);
      }
    }

    const all = loadLots();
    const idSet = new Set(ids);
    const updated = all.map(l => idSet.has(l.id) ? { ...l, isForSale: false } : l);
    saveLots(updated);

    res.json({ status: "success", count: success });
  });

// Vite middleware for development
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else if (!process.env.VERCEL) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
