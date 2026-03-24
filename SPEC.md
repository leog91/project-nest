# ProjectNest - GitHub Activity Dashboard

## Overview
Personal dashboard to track GitHub repository activity for leog91.

## Architecture

### Data Flow
```
GitHub API → Scraper Script → JSON File → Frontend (no API calls)
```

### Scraper (`scripts/scrape.ts`)
- Runs manually or via cron
- Fetches repos and commits sequentially (rate-limit friendly)
- Saves progress to `data/scrape-progress.json`
- Stores data in `data/repos.json`
- Resume capability: if rate-limited, continues from last successful fetch

### Frontend
- Reads from local JSON files (no GitHub API calls)
- No rate limit issues
- Fast page loads

## Tech Stack
- TanStack Start (latest)
- TanStack Query (for client-side caching)
- TanStack Table
- TypeScript
- Tailwind CSS v4

## Features

### Repository List (Home Page)
- Display all repositories from JSON
- Sort by last commit date (default)
- Show: name, last commit, first commit

### Repository Detail Page
- `/repo/:owner/:name`
- Show repo metadata and stats

## File Structure
```
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   └── repo.$owner.$name.tsx
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ThemeToggle.tsx
│   ├── QueryProvider.tsx
│   └── RepoTable.tsx
└── lib/
    └── github.ts          # Reads from JSON files

scripts/
└── scrape.ts             # GitHub scraper

data/
├── repos.json            # Cached repo data
└── scrape-progress.json  # Scraper state
```

## Commands

```bash
npm run dev           # Start dev server
npm run scrape       # Run scraper (default: leog91)
npm run scrape <user> # Scrape specific user
```
