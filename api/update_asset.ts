import fetch from "node-fetch";
import FormData from "form-data";
import { loadLots, saveLots, getRobloxHeaders } from "../src/lib/server-utils";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, universeId, apiKey, name, baseName, price, forSale, description } = req.body;
  if (!id || !universeId || !apiKey) return res.status(400).json({ error: "Missing info" });

  try {
    const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${id}`;
    
    const form = new FormData();
    if (name !== undefined) form.append("name", String(name));
    if (baseName !== undefined) form.append("description", `[Group: ${baseName}] ${description || ""}`);
    if (price !== undefined) form.append("price", String(price));
    if (forSale !== undefined) form.append("isForSale", String(forSale));

    const r = await fetch(url, {
      method: "PATCH",
      headers: { ...getRobloxHeaders(apiKey), ...form.getHeaders() },
      body: form
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Roblox Error ${r.status}: ${txt}`);
    }

    // Update local cache
    const lots = loadLots();
    const idx = lots.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
      if (name !== undefined) lots[idx].name = name;
      if (baseName !== undefined) lots[idx].baseName = baseName;
      if (price !== undefined) lots[idx].price = price;
      if (forSale !== undefined) lots[idx].isForSale = forSale;
      saveLots(lots);
    }

    res.status(200).json({ status: "success" });
  } catch (e: any) {
    res.status(500).json({ status: "error", message: e.message });
  }
}
