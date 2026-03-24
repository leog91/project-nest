export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  html_url: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string | null
  visibility: string
  default_branch: string
  created_at: string
  updated_at: string
  pushed_at: string
  commits?: {
    firstCommit: string | null
    lastCommit: string | null
    totalCommits?: number
  }
}

export interface CommitInfo {
  firstCommit: string | null
  lastCommit: string | null
  totalCommits: number
}

export interface RepoWithCommits extends GitHubRepo {
  commits: CommitInfo
}

export interface Commit {
  sha: string
  message: string
  author: string
  date: string
}

export interface DataMetadata {
  username: string
  lastUpdated: string | null
  repoCount: number
}

const DATE_LOCALE = 'en-US'
const DATE_TIME_ZONE = 'UTC'

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-'

  return new Date(dateString).toLocaleDateString(DATE_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: DATE_TIME_ZONE,
  })
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-'

  return new Date(dateString).toLocaleString(DATE_LOCALE, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: DATE_TIME_ZONE,
  })
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DATE_LOCALE).format(value)
}
