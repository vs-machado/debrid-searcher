# Debrid Searcher (TorBox)

A refined, industrial-style web interface for searching torrents via Torznab indexers and instantly verifying their cache status on TorBox.

## Key Features

- **Blazing Fast Search:** Connects to multiple Prowlarr/Jackett indexers simultaneously.
- **Cache Verification:** Instantly identifies which torrents are already cached on TorBox for immediate downloading.
- **Machined UI:** A high-contrast, professional-grade interface with staggered animations and smooth interactions.
- **Advanced Controls:**
  - **Sorting:** Order results by relevance, size, or seeders.
  - **Strict Cache Lock:** Toggle to restrict downloads to cached files only.
  - **Zip Packaging:** Option to request files as a ZIP archive.
  - **Adjustable Pagination:** Choose between 10, 20, 50, or 100 results per page.
- **Polished Experience:** Responsive design, detailed inspection modals, and accurate loading skeletons.

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

- **Web:** http://localhost:5173
- **Server:** http://localhost:5174

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
