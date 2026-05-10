import fetch from "node-fetch";
import FormData from "form-data";
import { loadLots, saveLots, getRobloxHeaders } from "../src/lib/server-utils";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { universeId, apiKey, price } = req.body;
  if (!universeId || !apiKey || price === undefined) {
    return res.status(400).json({ error: "Missing required information" });
  }

  const lots = loadLots().filter(l => String(l.universeId) === String(universeId));
  
  let success = 0;
  for (const lot of lots) {
    try {
      const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${lot.id}`;
      const form = new FormData();
      form.append("price", String(price));
      form.append("isForSale", "true");

      const r = await fetch(url, {
        method: "PATCH",
        headers: { ...getRobloxHeaders(apiKey), ...form.getHeaders() },
        body: form
      });

      if (r.ok) success++;
      // Wait to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.error(`Sync failed for ${lot.id}:`, e);
    }
  }

  const all = loadLots();
  const updated = all.map(l => (String(l.universeId) === String(universeId)) ? { ...l, price, isForSale: true } : l);
  saveLots(updated);

  res.status(200).json({ status: "success", count: success });
}
