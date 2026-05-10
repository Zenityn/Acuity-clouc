import fetch from "node-fetch";
import FormData from "form-data";
import Busboy from "busboy";
import { loadLots, saveLots, getRobloxHeaders } from "../src/lib/server-utils.ts";

export const config = {
  api: {
    bodyParser: false, // Disabling body parser for multipart
  },
};

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const busboy = Busboy({ headers: req.headers });
  const fields: any = {};
  let fileBuffer: Buffer | null = null;
  let fileName = '';
  let fileType = '';

  busboy.on('field', (name, val) => {
    fields[name] = val;
  });

  busboy.on('file', (name, file, info) => {
    const { filename, mimeType } = info;
    fileName = filename;
    fileType = mimeType;
    const chunks: any[] = [];
    file.on('data', (data) => {
      chunks.push(data);
    });
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  busboy.on('finish', async () => {
    const { name, description, price, isForSale, universeId, apiKey, baseName } = fields;

    if (!name || !universeId || !apiKey || !fileBuffer) {
      return res.status(400).json({ error: "Missing required creation data (name, universeId, apiKey, or icon)" });
    }

    try {
      const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`;
      
      const form = new FormData();
      form.append("name", name);
      form.append("description", description || "Created via BloxEx Cloud Manager");
      form.append("price", String(price || 0));
      form.append("isForSale", String(isForSale === 'true' || isForSale === true));
      form.append("imageFile", fileBuffer, {
        filename: fileName || 'icon.jpg',
        contentType: fileType || 'image/jpeg',
      });

      const r = await fetch(url, {
        method: "POST",
        headers: { 
          ...getRobloxHeaders(apiKey), 
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
        throw new Error(data.message || (data.errors && data.errors[0]?.message) || `Roblox Error ${r.status}`);
      }

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

      res.status(200).json({ status: "success", gamePassId: data.gamePassId });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  req.pipe(busboy);
}
