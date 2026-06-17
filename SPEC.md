# ProjectNest - GitHub Activity Dashboard

## Overview

Personal dashboard to track and browse GitHub repository activity.

## Architecture

### Data Flow

```
GitHub API → Scraper Script → app-data/repos.data → Frontend
```

The frontend does **not** call the GitHub API for repository metadata. It reads the scraped local data file. README content is the exception: it is fetched client-side from `raw.githubusercontent.com` and cached in the browser by TanStack Query.

### Scraper (`scripts/scrape.ts`)

- Runs manually via `npm run scrape [user]`.
- Fetches repos and commit metadata sequentially to stay rate-limit friendly.
- Saves progress to `.cache/scrape-progress.json`.
- Stores data in `app-data/repos.data`.
- **Resume capability**: if rate-limited or interrupted, it continues from the last successful fetch.
- **Incremental updates**: repos whose `pushed_at` timestamp has not changed keep their existing commit and language data, avoiding unnecessary API calls.
- If a repo has a new push, its commit metadata and language data are refreshed automatically.

### Frontend

- Reads from `app-data/repos.data` for repo metadata and commit info (no GitHub API calls).
- Renders READMEs on demand by fetching Markdown directly from `raw.githubusercontent.com`.
- TanStack Query caches README content in the browser for 5 minutes.

## Tech Stack

- TanStack Start (latest)
- TanStack Router
- TanStack Query (client-side caching for READMEs)
- TanStack Table
- React Markdown + remark-gfm + rehype-sanitize
- TypeScript
- Tailwind CSS v4

## Features

### Repository List (Home Page)

- Display all repositories from `app-data/repos.data`.
- Sortable table with name, stars, forks, language, last push, and visibility.

### Repository Detail Page

- `/repo/:owner/:name`
- Shows repo metadata, stats, and a rendered README.
- README is fetched client-side from GitHub's raw CDN and styled with `@tailwindcss/typography`.

## File Structure

```
app-data/
└── repos.data              # Cached repo data (generated)

.cache/
├── scrape-state.json       # Scraper state (generated)
└── scrape-progress.json    # Scraper progress (generated)

public/
├── app-icon.svg
├── favicon.ico
├── logo192.png
├── logo512.png
└── manifest.json

scripts/
└── scrape.ts               # GitHub scraper

src/
├── components/
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── QueryProvider.tsx
│   ├── RepoReadme.tsx
│   ├── RepoTable.tsx
│   └── ThemeToggle.tsx
├── lib/
│   ├── github.server.ts    # Server-side data access
│   ├── github.ts           # Helpers and types
│   └── languageColors.ts   # Language color map
├── routes/                 # TanStack file-based routes
│   ├── __root.tsx          # Root layout
│   ├── about.tsx
│   ├── index.tsx           # Home / repo list
│   └── repo.$owner.$name.tsx # Repo detail page
├── router.tsx
└── styles.css
```

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run scrape           # Run scraper (default: leog91)
npm run scrape <user>    # Scrape specific user
npm run scrape:status    # Print scraper status
```
