# Debrid Searcher (TorBox)

A refined, industrial-style web interface for searching torrents via Torznab indexers and instantly verifying their cache status on TorBox.

## Key Features

- **Authentication:** Login system with persistent sessions to protect your server instance.
- **Search:** Simultaneous searching across multiple Prowlarr/Jackett indexers.
- **Cache Verification:** Real-time checking of torrent status against TorBox cloud for immediate streaming.
- **Advanced Controls:**
  - **Sorting:** Multi-parameter ordering by Relevance, Size, or Seeds.
  - **Zip Packaging:** Toggle for requesting files as a single ZIP archive.
  - **Custom Pagination:** Adjustable results per page (10, 20, 50, or 100).

## Setup

1) Install dependencies

```bash
npm run install:all
```

2) Configure the server

Copy `server/.env.example` to `server/.env` and fill:

- `TORBOX_API_KEY` (Your TorBox API key)
- `INDEXERS_TORZNAB_URLS` (One or more Torznab API endpoints)

Example `INDEXERS_TORZNAB_URLS`:

```env
INDEXERS_TORZNAB_URLS=["http://localhost:9117/api/v2.0/indexers/all/results/torznab/api?apikey=YOUR_KEY"]
```

## Run (Development)

```bash
npm run dev
```

- **Web:** http://localhost:5175
- **Server:** http://localhost:5174

## Setup Jackett/Prowlarr

Ensure your indexer manager (e.g., Jackett) is accessible at `http://localhost:9117`. 
1. Open `http://localhost:9117` in your browser.
2. Add your desired indexers to Jackett.
3. Use the provided Torznab URLs in the server `.env` configuration.

## Build & Deploy (Production)

```bash
npm run build
npm start
```

The server automatically serves the built UI from `web/dist`.

## API Documentation

- `GET /api/search?q=...`: Search across indexers and check cache status.
- `POST /api/torbox/add`: Add a magnet to TorBox account.
- `POST /api/torbox/download`: Request a direct download link from TorBox.
- `GET /api/auth/session`: Check current login session.
