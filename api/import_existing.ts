import fetch from "node-fetch";
import { loadLots, saveLots, getRobloxHeaders } from "../src/lib/server-utils";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filterName, universeId, apiKey } = req.body;
  if (!universeId || !apiKey) return res.status(400).json({ error: "Missing credentials" });

  try {
    const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/creator`;
    const response = await fetch(url, { headers: getRobloxHeaders(apiKey) });
    const data: any = await response.json();

    if (!response.ok) throw new Error(data.message || "Roblox API error");

    const allPasses = data.gamePasses || [];
    const matched = filterName 
      ? allPasses.filter((p: any) => p.name.toLowerCase().includes(filterName.toLowerCase()))
      : allPasses;

    const existing = loadLots();
    const existingIds = new Set(existing.map(l => String(l.id)));

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

    res.status(200).json({ status: "success", count: newLots.length });
  } catch (e: any) {
    res.status(500).json({ status: "error", message: e.message });
  }
}
