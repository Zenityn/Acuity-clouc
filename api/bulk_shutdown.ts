import fetch from "node-fetch";
import FormData from "form-data";
import { loadLots, saveLots, getRobloxHeaders } from "../src/lib/server-utils";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        headers: { ...getRobloxHeaders(apiKey), ...form.getHeaders() },
        body: form
      });

      if (r.ok) success++;
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (e) {
      console.error(`Shutdown failed for ${id}:`, e);
    }
  }

  const all = loadLots();
  const idSet = new Set(ids.map(id => String(id)));
  const updated = all.map(l => idSet.has(String(l.id)) ? { ...l, isForSale: false } : l);
  saveLots(updated);

  res.status(200).json({ status: "success", count: success });
}
