<p align="center">
  <img src="web/public/website_logo.png" alt="Debrid Searcher logo" width="140" />
</p>

# Debrid Searcher (TorBox)

A web interface for searching torrents via Torznab indexers and instantly verifying their cache status on TorBox.

<p align="center">
  <img src="login.jpg" alt="Login screen" width="48%" />
  <img src="searcher.jpg" alt="Search screen" width="48%" />
</p>

## Disclaimer

Debrid Searcher does not endorse piracy and does not host any content. It is a torrent cache checker.

The torrent indexers you configure and any torrents you search for or download are the sole responsibility of each user.

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

- `PORT` (Server listen port; default: `5174`)
- `TORBOX_BASE_URL` (TorBox API base URL; default: `https://api.torbox.app`)
- `TORBOX_API_KEY` (Your TorBox API key)
- `INDEXERS_TORZNAB_URLS` (One or more Torznab API endpoint URLs; include the `apikey` in the URL)
- `AUTH_USERNAME` (Single-user login username)
- `AUTH_PASSWORD` (Single-user login password)
- `AUTH_COOKIE_SECRET` (Long random string for signing auth cookies; e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Optional:

- `LOG_HTTP` (Log requests)
- `LOG_HTTP_BODY` (Log request bodies)
- `LOG_TORBOX` (Log TorBox requests)

Example `INDEXERS_TORZNAB_URLS` (JSON array recommended):

```env
INDEXERS_TORZNAB_URLS=["http://localhost:9117/api/v2.0/indexers/all/results/torznab/api?apikey=YOUR_KEY"]
```

Example `INDEXERS_TORZNAB_URLS` (Docker Compose with the included `jackett` service):

```env
INDEXERS_TORZNAB_URLS=["http://jackett:9117/api/v2.0/indexers/all/results/torznab/api?apikey=YOUR_KEY"]
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

## Deploy (Docker)

1) Create your env file: copy `server/.env.example` to `server/.env` and set at least `TORBOX_API_KEY`, `INDEXERS_TORZNAB_URLS`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_COOKIE_SECRET`.

2) Build and run (Docker Compose):

```bash
docker compose up -d --build
```

Or build and run (plain Docker):

```bash
docker build -t debrid-searcher .
docker run -d --name debrid_searcher -p 5175:5174 --env-file server/.env debrid-searcher
```

3) View logs / stop:

```bash
docker compose logs -f app
docker compose down
```

Plain Docker equivalents:

```bash
docker logs -f debrid_searcher
docker stop debrid_searcher
docker rm debrid_searcher
```

Defaults:

- App: http://localhost:5175
- Jackett UI (if using the included service): http://localhost:9117

## API Documentation

- `GET /api/search?q=...`: Search across indexers and check cache status.
- `POST /api/torbox/add`: Add a magnet to TorBox account.
- `POST /api/torbox/download`: Request a direct download link from TorBox.
- `GET /api/auth/session`: Check current login session.
