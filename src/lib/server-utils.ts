import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In Vercel or local dev, we need a consistent path for the JSON file
// Using /tmp for Vercel is often necessary for transient storage, 
// but for this applet environment, we'll keep it in the root or a known location.
const LOTS_FILE = path.join(process.cwd(), "active_lots.json");

export function loadLots(): any[] {
  try {
    if (fs.existsSync(LOTS_FILE)) {
      const data = fs.readFileSync(LOTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error loading lots:", e);
  }
  return [];
}

export function saveLots(lots: any[]) {
  try {
    fs.writeFileSync(LOTS_FILE, JSON.stringify(lots, null, 2));
  } catch (e) {
    console.error("Error saving lots:", e);
  }
}

export const getRobloxHeaders = (apiKey: string) => ({
  "x-api-key": apiKey,
});
