# Debrid Searcher (TorBox)

Vite + TypeScript web UI that searches torrents via Torznab indexers (Prowlarr/Jackett), then checks which results are cached on TorBox.

## Setup

1) Install dependencies

```bash
npm run install:all
```

2) Configure the server

Copy `server/.env.example` to `server/.env` and fill:

- `TORBOX_API_KEY`
- `INDEXERS_TORZNAB_URLS`

`INDEXERS_TORZNAB_URLS` should be one or more Torznab API URLs (including the apikey in the URL). Example:

```env
INDEXERS_TORZNAB_URLS=["http://localhost:9117/api/v2.0/indexers/all/results/torznab/api?apikey=YOUR_JACKETT_OR_PROWLARR_KEY"]
```

## Run (dev)

```bash
npm run dev
```

- Web: http://localhost:5173
- Server: http://localhost:5174

## Build + Run (prod)

```bash
npm run build
npm start
```

The server serves the built UI from `web/dist`.

## API

- `GET /api/search?q=...`
- `POST /api/torbox/add` `{ magnet: string, addOnlyIfCached?: boolean }`
