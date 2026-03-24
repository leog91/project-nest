import fs from 'fs/promises'
import path from 'path'
import type { Commit, CommitInfo, DataMetadata, GitHubRepo } from './github'

const DATA_FILE = path.join(process.cwd(), 'data', 'repos.json')

async function loadRepos(): Promise<GitHubRepo[]> {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    const data = JSON.parse(content)
    return data.repos || []
  } catch {
    return []
  }
}

export async function getDataMetadata(): Promise<DataMetadata> {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    const data = JSON.parse(content)
    return {
      username: data.username || 'unknown',
      lastUpdated: data.lastUpdated || null,
      repoCount: (data.repos || []).length
    }
  } catch {
    return { username: 'unknown', lastUpdated: null, repoCount: 0 }
  }
}

export async function getUserRepos(_username: string): Promise<GitHubRepo[]> {
  return loadRepos()
}

export async function getRepoStats(owner: string, repo: string): Promise<CommitInfo> {
  const repos = await loadRepos()
  const found = repos.find(r => r.owner.login === owner && r.name === repo)
  
  if (found?.commits) {
    return {
      ...found.commits,
      totalCommits: found.commits.totalCommits ?? 0
    }
  }
  
  return { firstCommit: null, lastCommit: null, totalCommits: 0 }
}

export async function getRepoDetails(owner: string, repo: string): Promise<GitHubRepo | null> {
  const repos = await loadRepos()
  return repos.find(r => r.owner.login === owner && r.name === repo) || null
}

export async function getRecentCommits(
  _owner: string,
  _repo: string,
  _limit = 10
): Promise<Commit[]> {
  return []
}
