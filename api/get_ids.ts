import { loadLots } from "../src/lib/server-utils.ts";

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.status(200).json({ lots: loadLots() });
}
