import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Calendar, GitBranch, Star, GitFork, ExternalLink } from 'lucide-react'
import { formatDate, formatNumber } from '../lib/github'
import { getLanguageColor } from '../lib/languageColors'
import RepoReadme from '../components/RepoReadme'

const getRepoPageData = createServerFn({ method: 'GET' })
  .inputValidator((data: { owner: string; name: string }) => data)
  .handler(async ({ data }) => {
    const { getRepoDetails } = await import('../lib/github.server')
    const repo = await getRepoDetails(data.owner, data.name)

    return {
      owner: data.owner,
      name: data.name,
      repo,
    }
  })

export const Route = createFileRoute('/repo/$owner/$name')({
  loader: ({ params }) => getRepoPageData({ data: params }),
  component: RepoDetailPage,
})

function RepoDetailPage() {
  const { owner, name, repo } = Route.useLoaderData()

  if (!repo) {
    return (
      <main className="page-wrap px-0 pb-8 pt-14 sm:px-4">
        <div className="island-shell rounded-2xl p-8 text-center">
          <p className="text-[var(--sea-ink-soft)]">Repository not found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-0 pb-8 pt-14 sm:px-4">
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
            {repo.languages && Object.keys(repo.languages).length > 0 ? (
              Object.entries(repo.languages)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([lang]) => {
                  const color = getLanguageColor(lang)
                  return (
                    <span
                      key={lang}
                      className="border-2 border-[var(--line)] border-l-[8px] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-bold text-[var(--sea-ink-soft)]"
                      style={color ? { borderLeftColor: color } : undefined}
                    >
                      {lang}
                    </span>
                  )
                })
            ) : repo.language ? (
              <span
                className="border-2 border-[var(--line)] border-l-[8px] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-bold text-[var(--sea-ink-soft)]"
                style={{ borderLeftColor: getLanguageColor(repo.language) || 'var(--line)' }}
              >
                {repo.language}
              </span>
            ) : null}
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

          <RepoReadme
            owner={owner}
            name={name}
            defaultBranch={repo.default_branch}
          />
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
