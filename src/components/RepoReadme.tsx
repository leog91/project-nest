import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { BookOpen, Loader2, AlertCircle } from 'lucide-react'

interface RepoReadmeProps {
  owner: string
  name: string
  defaultBranch: string
}

function resolveUrl(
  src: string | undefined,
  owner: string,
  name: string,
  branch: string,
  type: 'raw' | 'blob'
): string | undefined {
  if (!src) return undefined
  if (src.startsWith('http') || src.startsWith('#') || src.startsWith('mailto:')) return src

  const clean = src.replace(/^\.\/|\//, '')
  const base =
    type === 'raw'
      ? `https://raw.githubusercontent.com/${owner}/${name}/${branch}/`
      : `https://github.com/${owner}/${name}/blob/${branch}/`
  return base + clean
}

async function fetchReadme(owner: string, name: string, branch: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/README.md`
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('README not found')
    }
    throw new Error(`Failed to load README (${response.status})`)
  }

  return response.text()
}

export default function RepoReadme({ owner, name, defaultBranch }: RepoReadmeProps) {
  const { data, isPending, error } = useQuery({
    queryKey: ['readme', owner, name, defaultBranch],
    queryFn: () => fetchReadme(owner, name, defaultBranch),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 border-b border-[var(--line)] pb-4">
        <BookOpen className="h-5 w-5 text-[var(--kicker)]" />
        <h2 className="text-lg font-semibold text-[var(--sea-ink)]">README</h2>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--sea-ink-soft)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading README…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 py-4 text-sm text-[var(--sea-ink-soft)]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--lagoon)]" />
          <span>
            {error.message === 'README not found'
              ? 'No README found for this repository.'
              : `Could not load README: ${error.message}`}
          </span>
        </div>
      ) : data ? (
        <article className="readme-github prose prose-slate max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              img: ({ src, alt }: { src?: string; alt?: string }) => {
                const resolved = resolveUrl(src, owner, name, defaultBranch, 'raw')
                return resolved ? (
                  <img
                    src={resolved}
                    alt={alt || ''}
                    className="my-4 rounded-lg"
                    loading="lazy"
                  />
                ) : null
              },
              a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
                const resolved = resolveUrl(href, owner, name, defaultBranch, 'blob')
                return (
                  <a
                    href={resolved || href}
                    target={resolved?.startsWith('#') ? undefined : '_blank'}
                    rel={resolved?.startsWith('#') ? undefined : 'noopener noreferrer'}
                    className="font-semibold text-[var(--lagoon-deep)] underline decoration-[var(--lagoon)] underline-offset-2 hover:text-[var(--lagoon)]"
                  >
                    {children}
                  </a>
                )
              },
            }}
          >
            {data}
          </ReactMarkdown>
        </article>
      ) : null}
    </section>
  )
}
