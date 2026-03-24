import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import RepoTable from '../components/RepoTable'
import { formatDateTime } from '../lib/github'

const getHomePageData = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDataMetadata, getUserRepos } = await import('../lib/github.server')
  const repos = await getUserRepos('leog91')
  const metadata = await getDataMetadata()

  const reposWithCommits = repos.map((repo) => ({
    ...repo,
    commits: {
      firstCommit: repo.commits?.firstCommit ?? null,
      lastCommit: repo.commits?.lastCommit ?? null,
      totalCommits: repo.commits?.totalCommits ?? 0,
    },
  }))

  return { repos: reposWithCommits, metadata }
})

export const Route = createFileRoute('/')({
  loader: () => getHomePageData(),
  component: HomePage,
})

function HomePage() {
  const { repos, metadata } = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="island-kicker mb-1">GitHub Activity</div>
          <h1 className="display-title text-3xl font-bold text-[var(--sea-ink)]">
            leog91's Repositories
          </h1>
          {metadata && (
            <div className="mt-2 flex items-center gap-3 text-sm text-[var(--sea-ink-soft)]">
              <span className="inline-flex items-center gap-1">
                {metadata.repoCount} repos
              </span>
              {metadata.lastUpdated && (
                <span>
                  Last scraped: {formatDateTime(metadata.lastUpdated)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {repos.length === 0 && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
          <p className="text-[var(--sea-ink-soft)]">
            No repositories found. Run the scraper to fetch data:
          </p>
          <code className="mt-2 inline-block rounded bg-[var(--chip-bg)] px-3 py-1 text-sm">
            npm run scrape
          </code>
        </div>
      )}

      <div className="island-shell overflow-hidden rounded-2xl">
        <RepoTable data={repos} />
        
        {repos.length > 0 && (
          <div className="border-t border-[var(--line)] px-4 py-3 text-center text-sm text-[var(--sea-ink-soft)]">
            {repos.length} repositories · Sorted by last commit
          </div>
        )}
      </div>
    </main>
  )
}
