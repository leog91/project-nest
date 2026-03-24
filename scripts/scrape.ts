import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = 'app-data'
const SCRAPER_DIR = '.cache'
const DATA_FILE = path.join(DATA_DIR, 'repos.data')
const PROGRESS_FILE = path.join(SCRAPER_DIR, 'scrape-progress.json')
const STATE_FILE = path.join(SCRAPER_DIR, 'scrape-state.json')
const ENV_FILE = '.env'
const STALE_RUN_MS = 5 * 60 * 1000

const GITHUB_API = 'https://api.github.com'
const USERNAME = process.argv[2] || 'leog91'
let GITHUB_TOKEN = process.env.GITHUB_TOKEN

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim()
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))

  return quoted ? value.slice(1, -1) : value
}

async function loadEnvFile() {
  try {
    const content = await fs.readFile(ENV_FILE, 'utf-8')

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = parseEnvValue(trimmed.slice(separatorIndex + 1))

      if (key && !(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // Optional local env file.
  }
}

interface Repo {
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
    isEmpty?: boolean
  }
}

interface ScrapeState {
  username: string
  startedAt: string | null
  lastRunAt: string | null
  completedAt: string | null
  isRunning: boolean
  isComplete: boolean
  currentPhase: 'idle' | 'fetching-repos' | 'fetching-commits' | 'complete' | 'error'
  currentItem: string | null
  error: string | null
  stats: {
    totalRepos: number
    reposWithCommits: number
    totalCommitsFetched: number
    apiCalls: number
  }
}

interface Progress {
  phase: 'repos' | 'commits'
  repoPage: number
  totalRepoPages: number
  processedRepoNames: string[]
  currentRepoIndex: number
  lastCommitRepo: string | null
}

class RateLimitError extends Error {
  waitSeconds: number

  constructor(waitSeconds: number) {
    super(`Rate limited. Try again in about ${waitSeconds}s.`)
    this.name = 'RateLimitError'
    this.waitSeconds = waitSeconds
  }
}

class EmptyRepositoryError extends Error {
  constructor() {
    super('Git repository is empty.')
    this.name = 'EmptyRepositoryError'
  }
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(SCRAPER_DIR, { recursive: true })
}

async function loadState(): Promise<ScrapeState> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {
      username: USERNAME,
      startedAt: null,
      lastRunAt: null,
      completedAt: null,
      isRunning: false,
      isComplete: false,
      currentPhase: 'idle',
      currentItem: null,
      error: null,
      stats: {
        totalRepos: 0,
        reposWithCommits: 0,
        totalCommitsFetched: 0,
        apiCalls: 0
      }
    }
  }
}

async function saveState(state: ScrapeState) {
  await ensureDir()
  state.lastRunAt = new Date().toISOString()
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2))
}

async function loadProgress(): Promise<Progress | null> {
  try {
    const content = await fs.readFile(PROGRESS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function saveProgress(progress: Progress) {
  await ensureDir()
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function clearProgress() {
  await fs.rm(PROGRESS_FILE, { force: true })
}

async function removeLegacyDataFiles() {
  await fs.rm(path.join('data', 'repos.json'), { force: true })
  await fs.rm(path.join('data', 'repos.data'), { force: true })
}

async function loadRepos(): Promise<Repo[]> {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    const data = JSON.parse(content)
    return data.repos || []
  } catch {
    return []
  }
}

async function saveRepos(repos: Repo[]) {
  await ensureDir()
  await fs.writeFile(DATA_FILE, JSON.stringify({
    username: USERNAME,
    lastUpdated: new Date().toISOString(),
    repos
  }, null, 2))
}

function hasCompleteCommitData(repo: Repo): boolean {
  return (
    typeof repo.commits?.totalCommits === 'number' &&
    (Boolean(repo.commits?.lastCommit) || repo.commits?.isEmpty === true)
  )
}

function mergeRepoData(existingRepo: Repo, fetchedRepo: Repo): Repo {
  const pushChanged = existingRepo.pushed_at !== fetchedRepo.pushed_at

  return {
    ...existingRepo,
    ...fetchedRepo,
    commits: pushChanged ? undefined : existingRepo.commits,
  }
}

let state: ScrapeState
let progress: Progress
let repos: Repo[]
let apiCalls = 0

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function updateState(updates: Partial<ScrapeState>) {
  state = { ...state, ...updates }
  await saveState(state)
}

function isStaleRun(currentState: ScrapeState): boolean {
  if (!currentState.isRunning || !currentState.lastRunAt) {
    return false
  }

  const lastRunAt = Date.parse(currentState.lastRunAt)
  if (Number.isNaN(lastRunAt)) {
    return true
  }

  return Date.now() - lastRunAt > STALE_RUN_MS
}

function shouldClearRunningState(currentState: ScrapeState): boolean {
  return currentState.currentPhase === 'error' || isStaleRun(currentState)
}

async function fetchWithRetry(url: string, retries = 5): Promise<unknown> {
  for (let i = 0; i < retries; i++) {
    apiCalls++
    try {
      state.stats.apiCalls = apiCalls
      await saveState(state)

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ProjectNest',
      }

      if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`
      }

      const response = await fetch(url, { headers })

      const remaining = response.headers.get('X-RateLimit-Remaining')
      const reset = response.headers.get('X-RateLimit-Reset')
      
      if (remaining !== null) {
        log(`API calls: ${apiCalls} | Rate limit remaining: ${remaining}`)
      }

      if (response.status === 403 || response.status === 429) {
        let waitSeconds = 60
        if (reset) {
          const resetTime = parseInt(reset, 10) * 1000
          waitSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000) + 2)
        }
        log(`Rate limited! Stopping for now. Retry in about ${waitSeconds}s.`)
        await updateState({ currentPhase: 'error', error: `Rate limited, waiting ${waitSeconds}s` })
        throw new RateLimitError(waitSeconds)
      }

      if (!response.ok) {
        const responseText = await response.text()
        if (response.status === 409 && responseText.includes('Git Repository is empty')) {
          throw new EmptyRepositoryError()
        }
        throw new Error(`HTTP ${response.status}: ${responseText}`)
      }

      return response.json()
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof EmptyRepositoryError) {
        throw err
      }

      if (i === retries - 1) throw err
      log(`Retry ${i + 1}/${retries} after error: ${err}`)
      await new Promise(resolve => setTimeout(resolve, 3000 * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}

async function fetchResponseWithRetry(url: string, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    apiCalls++
    try {
      state.stats.apiCalls = apiCalls
      await saveState(state)

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ProjectNest',
      }

      if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`
      }

      const response = await fetch(url, { headers })
      const remaining = response.headers.get('X-RateLimit-Remaining')
      const reset = response.headers.get('X-RateLimit-Reset')

      if (remaining !== null) {
        log(`API calls: ${apiCalls} | Rate limit remaining: ${remaining}`)
      }

      if (response.status === 403 || response.status === 429) {
        let waitSeconds = 60
        if (reset) {
          const resetTime = parseInt(reset, 10) * 1000
          waitSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000) + 2)
        }
        log(`Rate limited! Stopping for now. Retry in about ${waitSeconds}s.`)
        await updateState({ currentPhase: 'error', error: `Rate limited, waiting ${waitSeconds}s` })
        throw new RateLimitError(waitSeconds)
      }

      if (!response.ok) {
        const responseText = await response.text()
        if (response.status === 409 && responseText.includes('Git Repository is empty')) {
          throw new EmptyRepositoryError()
        }
        throw new Error(`HTTP ${response.status}: ${responseText}`)
      }

      return response
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof EmptyRepositoryError) {
        throw err
      }

      if (i === retries - 1) throw err
      log(`Retry ${i + 1}/${retries} after error: ${err}`)
      await new Promise(resolve => setTimeout(resolve, 3000 * (i + 1)))
    }
  }

  throw new Error('Max retries exceeded')
}

function getLastPageFromLinkHeader(linkHeader: string | null): number | null {
  if (!linkHeader) return null

  const match = linkHeader.match(/&page=(\d+)>;\s*rel="last"/)
  if (!match) return null

  const page = Number.parseInt(match[1], 10)
  return Number.isFinite(page) ? page : null
}

async function fetchRepos(page: number): Promise<Repo[]> {
  log(`Fetching repos page ${page}...`)
  await updateState({ currentPhase: 'fetching-repos', currentItem: `page ${page}` })
  const data = await fetchWithRetry(
    `${GITHUB_API}/users/${USERNAME}/repos?per_page=100&page=${page}&sort=pushed`
  ) as Repo[]
  return data || []
}

async function fetchCommits(owner: string, repo: string): Promise<{ firstCommit: string | null; lastCommit: string | null; totalCommits: number }> {
  log(`  Fetching commits for ${repo}...`)
  await updateState({ currentPhase: 'fetching-commits', currentItem: `${owner}/${repo}` })
  
  try {
    const latestResponse = await fetchResponseWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=1&page=1`
    )
    const latestData = await latestResponse.json() as Array<{ commit: { author: { date: string } } }>

    if (!latestData?.length) {
      return { firstCommit: null, lastCommit: null, totalCommits: 0 }
    }

    const lastCommit = latestData[0]?.commit?.author?.date || null
    const lastPage = getLastPageFromLinkHeader(latestResponse.headers.get('link'))

    if (!lastPage) {
      return {
        firstCommit: lastCommit,
        lastCommit,
        totalCommits: 1,
      }
    }

    const oldestData = await fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=1&page=${lastPage}`
    ) as Array<{ commit: { author: { date: string } } }>

    return {
      firstCommit: oldestData?.[0]?.commit?.author?.date || null,
      lastCommit,
      totalCommits: lastPage,
    }
  } catch (err) {
    if (err instanceof EmptyRepositoryError) {
      log(`  ${repo} is empty. Skipping commit history.`)
      return { firstCommit: null, lastCommit: null, totalCommits: 0, isEmpty: true }
    }

    return { firstCommit: null, lastCommit: null, totalCommits: 0 }
  }
}

async function printState() {
  const s = await loadState()
  const p = await loadProgress()
  const r = await loadRepos()
  
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║                    SCRAPER STATE                            ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║ Username:        ${s.username.padEnd(42)}║`)
  console.log(`║ Status:         ${(s.isComplete ? '✓ Complete' : s.isRunning ? '⟳ Running' : '○ Idle').padEnd(42)}║`)
  console.log(`║ Phase:          ${(s.currentPhase || 'none').padEnd(42)}║`)
  if (s.currentItem) console.log(`║ Current:        ${s.currentItem.padEnd(42)}║`)
  if (s.error) console.log(`║ Error:          ${s.error.substring(0, 42).padEnd(42)}║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log('║                      DATA STATS                             ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║ Total Repos:    ${String(r.length).padEnd(42)}║`)
  console.log(`║ Repos w/Commits: ${String(r.filter(x => x.commits?.lastCommit).length).padEnd(41)}║`)
  console.log(`║ API Calls:      ${String(s.stats.apiCalls).padEnd(42)}║`)
  if (s.startedAt) console.log(`║ Started:        ${s.startedAt!.substring(0, 42).padEnd(42)}║`)
  if (s.lastRunAt) console.log(`║ Last Run:       ${s.lastRunAt!.substring(0, 42).padEnd(42)}║`)
  if (s.completedAt) console.log(`║ Completed:      ${s.completedAt!.substring(0, 42).padEnd(42)}║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log('║                    PROGRESS                                ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  if (p) {
    console.log(`║ Phase:          ${(p.phase || 'none').padEnd(42)}║`)
    console.log(`║ Repo Page:      ${String(p.repoPage).padEnd(42)}║`)
    console.log(`║ Processed:      ${String(p.processedRepoNames.length).padEnd(42)}║`)
    console.log(`║ Current Index:  ${String(p.currentRepoIndex).padEnd(42)}║`)
    if (p.lastCommitRepo) console.log(`║ Last Commit:    ${p.lastCommitRepo.substring(0, 42).padEnd(42)}║`)
  } else {
    console.log('║ No progress file found. Run scraper first.                ║')
  }
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
}

async function run() {
  await loadEnvFile()
  GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const command = process.argv[3]
  
  if (command === '--status' || command === '-s') {
    await printState()
    return
  }

  log(`\n=== GitHub Scraper for ${USERNAME} ===\n`)

  await ensureDir()
  await removeLegacyDataFiles()
  
  // Load existing state
  state = await loadState()
  
  // Check if scraper is already running
  if (state.isRunning) {
    if (shouldClearRunningState(state)) {
      log('Found leftover running state. Clearing it and resuming...')
      state.isRunning = false
      state.currentPhase = 'idle'
      state.currentItem = null
      await saveState(state)
    } else {
    log('Scraper is already running! Check status with: npm run scrape -- --status')
    await printState()
    return
    }
  }

  // Check if username changed
  if (state.username !== USERNAME) {
    log(`Username changed from ${state.username} to ${USERNAME}. Resetting...`)
    state = {
      ...state,
      username: USERNAME,
      startedAt: new Date().toISOString(),
      completedAt: null,
      isComplete: false,
      stats: { totalRepos: 0, reposWithCommits: 0, totalCommitsFetched: 0, apiCalls: 0 }
    }
  }

  state.startedAt = state.startedAt || new Date().toISOString()
  state.isRunning = true
  state.isComplete = false
  state.error = null
  await saveState(state)

  repos = await loadRepos()
  progress = await loadProgress() || {
    phase: 'repos',
    repoPage: 1,
    totalRepoPages: 0,
    processedRepoNames: [],
    currentRepoIndex: 0,
    lastCommitRepo: null
  }

  if (progress.phase === 'commits') {
    const firstIncompleteRepoIndex = repos.findIndex((repo) => !hasCompleteCommitData(repo))
    progress.currentRepoIndex = firstIncompleteRepoIndex === -1 ? repos.length : firstIncompleteRepoIndex
    progress.lastCommitRepo =
      progress.currentRepoIndex < repos.length ? repos[progress.currentRepoIndex].full_name : null
    await saveProgress(progress)
  }

  try {
    // Phase 1: Fetch all repos
    if (progress.phase === 'repos') {
      log('Phase 1: Fetching repositories...')
      
      let page = progress.repoPage
      let hasMore = true
      const seenRepoNames = new Set<string>()

      while (hasMore) {
        const fetchedRepos = await fetchRepos(page)
        
        if (fetchedRepos.length === 0) {
          log('No more repos found.')
          hasMore = false
          break
        }

        for (const repo of fetchedRepos) {
          seenRepoNames.add(repo.full_name)
          const existingRepoIndex = repos.findIndex((r) => r.full_name === repo.full_name)

          if (existingRepoIndex === -1) {
            repos.push(repo)
            continue
          }

          const existingRepo = repos[existingRepoIndex]
          const pushChanged = existingRepo.pushed_at !== repo.pushed_at
          repos[existingRepoIndex] = mergeRepoData(existingRepo, repo)

          if (pushChanged) {
            log(`Detected new push for ${repo.name}. Refreshing commit metadata.`)
          }
        }

        await saveRepos(repos)
        
        if (fetchedRepos.length < 100) {
          hasMore = false
        } else {
          page++
          progress.repoPage = page
          await saveProgress(progress)
        }
      }

      repos = repos.filter((repo) => seenRepoNames.has(repo.full_name))
      await saveRepos(repos)

      progress.phase = 'commits'
      progress.currentRepoIndex = 0
      await saveProgress(progress)
      state.stats.totalRepos = repos.length
      await updateState({ stats: state.stats })
      log(`Fetched ${repos.length} repos. Moving to commits...`)
    }

    // Phase 2: Fetch commits for each repo
    if (progress.phase === 'commits') {
      log(`Phase 2: Fetching commits for ${repos.length} repos...`)
      
      let reposWithCommits = repos.filter(r => r.commits?.lastCommit).length
      let totalCommitsFetched = repos.reduce((sum, repo) => sum + (repo.commits?.totalCommits ?? 0), 0)
      
      for (let i = progress.currentRepoIndex; i < repos.length; i++) {
        const repo = repos[i]
        const hadCommitData = Boolean(repo.commits?.lastCommit) || repo.commits?.isEmpty === true
        
        if (hasCompleteCommitData(repo)) {
          log(`Skipping ${repo.name} (already has commits)`)
          continue
        }

        progress.currentRepoIndex = i
        progress.lastCommitRepo = repo.full_name
        await saveProgress(progress)

        const commits = await fetchCommits(repo.owner.login, repo.name)
        repo.commits = commits
        
        if (!hadCommitData && commits.lastCommit) {
          reposWithCommits++
          state.stats.reposWithCommits = reposWithCommits
        }
        totalCommitsFetched += commits.totalCommits
        state.stats.totalCommitsFetched = totalCommitsFetched

        await saveRepos(repos)
        await updateState({ stats: state.stats })
        
        // Small delay between commits to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Complete
    state.completedAt = new Date().toISOString()
    state.isComplete = true
    state.isRunning = false
    state.currentPhase = 'complete'
    state.currentItem = null
    state.error = null
    await saveState(state)
    await clearProgress()

    log('\n=== SCRAPE COMPLETE ===')
    await printState()

  } catch (err) {
    state.isRunning = false
    state.error = err instanceof Error ? err.message : String(err)
    await updateState({ currentPhase: 'error' })
    log(`\nERROR: ${err}`)
    log('\nProgress saved. Run again to resume.')
    if (err instanceof RateLimitError && !GITHUB_TOKEN) {
      log('Tip: set GITHUB_TOKEN to raise the GitHub API rate limit.')
    }
    await printState()
  }
}

// Export for external use
export { printState }

run()
