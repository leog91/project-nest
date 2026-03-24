import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Calendar, GitBranch, Star, GitFork, ExternalLink } from 'lucide-react'
import { formatDate, formatNumber } from '../lib/github'

const getRepoPageData = createServerFn({ method: 'GET' })
  .inputValidator((data: { owner: string; name: string }) => data)
  .handler(async ({ data }) => {
    const { getRepoDetails, getRecentCommits } = await import('../lib/github.server')
    const [repo, commits] = await Promise.all([
      getRepoDetails(data.owner, data.name),
      getRecentCommits(data.owner, data.name, 15),
    ])

    return {
      owner: data.owner,
      name: data.name,
      repo,
      commits,
    }
  })

export const Route = createFileRoute('/repo/$owner/$name')({
  loader: ({ params }) => getRepoPageData({ data: params }),
  component: RepoDetailPage,
})

function RepoDetailPage() {
  const { owner, name, repo, commits } = Route.useLoaderData()

  if (!repo) {
    return (
      <main className="page-wrap px-4 pb-8 pt-14">
        <div className="island-shell rounded-2xl p-8 text-center">
          <p className="text-[var(--sea-ink-soft)]">Repository not found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <div className="island-shell rise-in overflow-hidden rounded-2xl">
        <div className="border-b border-[var(--line)] bg-gradient-to-r from-[rgba(79,184,178,0.08)] to-transparent px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="display-title mb-2 text-2xl font-bold text-[var(--sea-ink)]">
                {repo.name}
              </h1>
              <p className="text-sm text-[var(--sea-ink-soft)]">
                {owner} / {name}
              </p>
            </div>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
            >
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
          
          {repo.description && (
            <p className="mt-4 max-w-2xl text-[var(--sea-ink-soft)]">
              {repo.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-[var(--sea-ink-soft)]">
              <Star className="h-4 w-4" />
              {formatNumber(repo.stargazers_count)} stars
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--sea-ink-soft)]">
              <GitFork className="h-4 w-4" />
              {formatNumber(repo.forks_count)} forks
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--sea-ink-soft)]">
              <GitBranch className="h-4 w-4" />
              {repo.default_branch}
            </span>
            {repo.language && (
              <span className="rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--sea-ink-soft)]">
                {repo.language}
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Created"
              value={formatDate(repo.created_at)}
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatCard
              label="Last Push"
              value={formatDate(repo.pushed_at)}
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatCard
              label="Open Issues"
              value={formatNumber(repo.open_issues_count)}
              icon={<GitBranch className="h-4 w-4" />}
            />
            <StatCard
              label="Visibility"
              value={repo.visibility}
              icon={<GitBranch className="h-4 w-4" />}
            />
          </div>

          <h2 className="mb-4 text-lg font-semibold text-[var(--sea-ink)]">
            Recent Commits
          </h2>
          
          {commits && commits.length > 0 ? (
            <ul className="space-y-3">
              {commits.map((commit) => (
                <li
                  key={commit.sha}
                  className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:bg-[var(--link-bg-hover)]"
                >
                  <code className="mt-0.5 flex-shrink-0 rounded bg-[var(--chip-bg)] px-2 py-1 text-xs font-mono text-[var(--sea-ink-soft)]">
                    {commit.sha.slice(0, 7)}
                  </code>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--sea-ink)]">
                      {commit.message}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                      {commit.author} · {formatDate(commit.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">
              No commits found.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--kicker)]">
        {icon}
        {label}
      </div>
      <p className="text-lg font-semibold text-[var(--sea-ink)]">{value}</p>
    </div>
  )
}
