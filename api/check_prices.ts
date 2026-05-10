import fetch from "node-fetch";
import { loadLots, saveLots, getRobloxHeaders } from "../src/lib/server-utils";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { universeId, apiKey } = req.body;
  if (!universeId || !apiKey) return res.status(400).json({ error: "Missing info" });

  const lots = loadLots().filter(l => String(l.universeId) === String(universeId));
  
  const results = [];
  for (const lot of lots) {
    try {
      const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${lot.id}/creator`;
      const r = await fetch(url, { headers: getRobloxHeaders(apiKey) });
      const data: any = await r.json();
      
      if (r.ok) {
        lot.price = data.priceInformation?.defaultPriceInRobux || 0;
        lot.isForSale = !!data.priceInformation?.defaultPriceInRobux;
        results.push({ id: lot.id, price: lot.price, isForSale: lot.isForSale });
      }
    } catch (e) {
      console.error(`Audit failed for ${lot.id}:`, e);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const allLots = loadLots();
  const updatedLots = allLots.map(l => {
    const found = results.find(res => String(res.id) === String(l.id));
    return found ? { ...l, ...found } : l;
  });
  saveLots(updatedLots);

  res.status(200).json({ status: "success", audited: results.length });
}
