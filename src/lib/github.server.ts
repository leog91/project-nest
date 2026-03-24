import fs from 'fs/promises'
import path from 'path'
import { useStorage } from 'nitro/storage'
import type { Commit, CommitInfo, DataMetadata, GitHubRepo } from './github'

const dataStorage = useStorage('assets/data')
const DATA_FILE = 'repos.data'
const LOCAL_DATA_FILE = path.join(process.cwd(), 'app-data', DATA_FILE)

type RepoDataFile = {
  username?: string
  lastUpdated?: string | null
  repos?: GitHubRepo[]
}

async function loadRepoData(): Promise<RepoDataFile> {
  try {
    let raw: string | Uint8Array | null | undefined

    if (import.meta.env.PROD) {
      raw = await dataStorage.getItemRaw(DATA_FILE)
    } else {
      raw = await fs.readFile(LOCAL_DATA_FILE, 'utf-8')
    }

    if (!raw) return {}

    const content =
      typeof raw === 'string'
        ? raw
        : raw instanceof Uint8Array
          ? new TextDecoder().decode(raw)
          : String(raw)

    return JSON.parse(content) as RepoDataFile
  } catch {
    return {}
  }
}

async function loadRepos(): Promise<GitHubRepo[]> {
  const data = await loadRepoData()
  return data.repos || []
}

export async function getDataMetadata(): Promise<DataMetadata> {
  try {
    const data = await loadRepoData()

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
