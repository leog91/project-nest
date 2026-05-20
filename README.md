# ProjectNest — GitHub Activity Dashboard

A personal dashboard to track and browse GitHub repository activity. It scrapes data from the GitHub API and serves it through a fast, static frontend.

**Data Flow:** GitHub API → Scraper Script → `app-data/repos.data` → Frontend (no live API calls)

---

## Tech Stack

- **[TanStack Start](https://tanstack.com/start)** — Full-stack React framework
- **[TanStack Router](https://tanstack.com/router)** — File-based routing
- **[TanStack Query](https://tanstack.com/query)** — Client-side data caching
- **[TanStack Table](https://tanstack.com/table)** — Data tables
- **[Tailwind CSS v4](https://tailwindcss.com)** — Styling
- **[Nitro](https://nitro.unjs.io)** — Production server
- **[Vite](https://vitejs.dev)** — Build tool

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [pnpm](https://pnpm.io) (or npm — the project uses `pnpm` by convention, see `bun.lock` / `package-lock.json`)

---

## Installation

```bash
# Clone or navigate into the project
cd project-nest

# Install dependencies
pnpm install
# or: npm install
```

---

## Running the App

### Development

```bash
pnpm dev
# or: npm run dev
```

The dev server starts on `http://localhost:3000`.

> **WSL2 Users:** If you get `ERR_CONNECTION_RESET` when opening `localhost:3000` from Windows, the server is already configured to bind to all interfaces (`host: true` in `vite.config.ts`). If you still have issues, try accessing the app via the WSL2 IP:
> ```bash
> hostname -I
> # Then open http://<WSL_IP>:3000
> ```

### Production Build

```bash
pnpm build
# or: npm run build
```

### Preview Production Build

```bash
pnpm preview
# or: npm run preview
```

### Run Tests

```bash
pnpm test
# or: npm run test
```

---

## Updating the Data

The app does **not** call the GitHub API from the browser. Instead, a Node.js scraper fetches repositories and commit metadata, then stores everything in `app-data/repos.data`. The frontend reads this local file.

### 1. Set up a GitHub Token (Recommended)

Without a token, GitHub's unauthenticated rate limit is **60 requests per hour**. With a token, it jumps to **5,000 per hour**.

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your personal access token
# GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

You can create a token at [github.com/settings/tokens](https://github.com/settings/tokens) — no special scopes are required for public repo data.

### 2. Run the Scraper

```bash
# Scrape the default user (leog91)
pnpm scrape
# or: npm run scrape

# Scrape a specific GitHub user
pnpm scrape:leog91
# or: npm run scrape <username>
```

The scraper runs in two phases:
1. **Fetching repositories** — Pulls all repos for the user (paginated, 100 per page).
2. **Fetching commits** — For each repo, fetches the first and last commit dates and total commit count.

### 3. Check Scraper Status

```bash
pnpm scrape:status
# or: npm run scrape -- --status
```

This prints a summary of the current scrape state, including:
- Whether a scrape is running, idle, or complete
- How many repos and commits have been processed
- Total API calls made
- Any errors (e.g., rate limiting)

### Resume Capability

The scraper is fault-tolerant:
- If you hit a rate limit, it stops and saves progress.
- If you stop it manually (`Ctrl+C`), it saves progress.
- The next time you run `pnpm scrape`, it resumes exactly where it left off.
- If a repo gets a new push since the last scrape, its commit metadata is automatically refreshed.

### Data Files

| File | Description |
|------|-------------|
| `app-data/repos.data` | The main data file consumed by the frontend. Contains all repos, metadata, and commit info. |
| `.cache/scrape-state.json` | High-level scraper state (running/complete/error, stats). |
| `.cache/scrape-progress.json` | Low-level progress (current page, repo index) for resuming. |

---

## Project Structure

```
project-nest/
├── app-data/
│   └── repos.data              # Scraped GitHub data (generated)
├── .cache/
│   ├── scrape-state.json       # Scraper state (generated)
│   └── scrape-progress.json    # Scraper progress (generated)
├── public/                     # Static assets
├── scripts/
│   └── scrape.ts               # GitHub scraper script
├── src/
│   ├── components/
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── QueryProvider.tsx
│   │   ├── RepoTable.tsx
│   │   └── ThemeToggle.tsx
│   ├── lib/
│   │   └── github.ts           # Helpers to read local repo data
│   ├── routes/                 # TanStack file-based routes
│   │   ├── __root.tsx          # Root layout
│   │   ├── about.tsx
│   │   ├── index.tsx           # Home / repo list
│   │   └── repo.$owner.$name.tsx # Repo detail page
│   ├── router.tsx
│   └── styles.css
├── .env                        # GitHub token (not committed)
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Routes

| Route | Description |
|-------|-------------|
| `/` | Home page — lists all repositories in a sortable table. |
| `/repo/:owner/:name` | Detail page for a specific repository. |
| `/about` | About page. |

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the Vite dev server on port 3000. |
| `pnpm build` | Build the app for production. |
| `pnpm preview` | Preview the production build locally. |
| `pnpm test` | Run the Vitest test suite. |
| `pnpm scrape` | Run the GitHub scraper for the default user. |
| `pnpm scrape <user>` | Run the scraper for a specific GitHub user. |
| `pnpm scrape:status` | Print the current scraper status. |

---

## Troubleshooting

### `ERR_CONNECTION_RESET` on WSL2

If `localhost:3000` refuses to connect from your Windows browser, the Vite server is likely binding to `127.0.0.1` inside WSL2 only. This project already includes the fix in `vite.config.ts`:

```ts
server: {
  host: true, // Binds to 0.0.0.0
},
```

If the issue persists:
1. Try the WSL2 IP directly: `http://$(hostname -I | awk '{print $1}'):3000`
2. Ensure no other service is using port 3000.
3. Temporarily disable Windows Defender Firewall for WSL or add a rule for Node.js.

### Rate Limited During Scrape

If you see `Rate limited. Try again in about Xs.`:
1. Wait for the countdown and run `pnpm scrape` again — it will resume.
2. **Strongly recommended:** Add a `GITHUB_TOKEN` to `.env` to increase the limit from 60 to 5,000 requests/hour.

### Stale Scraper State

If the scraper thinks it's still running but you know it crashed:

```bash
pnpm scrape:status
# Then just run pnpm scrape again — it auto-detects stale runs (>5 min old)
# and clears them automatically.
```

---

## License

Private — for personal use.
