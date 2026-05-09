# BloxEx — Roblox Gamepass Manager

Web dashboard for managing Roblox gamepasses in bulk. No executor needed — runs as a Node.js server.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and set your ROBLOX_API_KEY
npm run dev
```

Open http://localhost:3000

## .env
```
ROBLOX_API_KEY=your_api_key_here
```

## Features
- Import existing gamepasses by base name + universe ID
- Create lots in bulk (rate-limited to 5 req/s)
- Set price per lot or bulk sync all
- Toggle on/off sale per lot or per group
- Audit live prices from Roblox API
- Group management in the Manage tab

## icon.jpg
Place your gamepass icon image as `icon.jpg` in the project root.

## active_lots.json
Auto-created. Tracks all lots with their ID, baseName, num, and universeId.
To add existing passes manually:
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"baseName":"CATI","universeId":"2705625021","ids":["id1","id2"]}'
```
