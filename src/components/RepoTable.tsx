import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { RepoWithCommits } from '../lib/github'
import { formatDate, formatNumber } from '../lib/github'
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'

const columnHelper = createColumnHelper<RepoWithCommits>()

const columns = [
  columnHelper.accessor('name', {
    header: 'Repository',
    cell: (info) => {
      const name = info.getValue()
      const fullName = info.row.original.full_name
      return (
        <Link
          to="/repo/$owner/$name"
          params={{ owner: fullName.split('/')[0], name: fullName.split('/')[1] }}
          className="font-medium text-[var(--lagoon-deep)] hover:text-[var(--lagoon)] no-underline hover:underline"
        >
          {name}
        </Link>
      )
    },
  }),
  columnHelper.accessor((row) => row.commits.lastCommit, {
    id: 'lastCommit',
    header: 'Last Commit',
    cell: (info) => (
      <span title={formatDate(info.getValue() ?? null)}>
        {info.getValue() ? formatDate(info.getValue()) : '-'}
      </span>
    ),
  }),
  columnHelper.accessor((row) => row.commits.firstCommit, {
    id: 'firstCommit',
    header: 'First Commit',
    cell: (info) => (
      <span title={formatDate(info.getValue() ?? null)}>
        {info.getValue() ? formatDate(info.getValue()) : '-'}
      </span>
    ),
  }),
  columnHelper.accessor((row) => row.commits.totalCommits, {
    id: 'totalCommits',
    header: 'Commits',
    cell: (info) => {
      const count = info.getValue()
      return count > 0 ? formatNumber(count) : '-'
    },
  }),
]

interface RepoTableProps {
  data: RepoWithCommits[]
}

export default function RepoTable({ data }: RepoTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'lastCommit', desc: true }
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--sea-ink-soft)]">
        No repositories found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-[var(--line)]">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-sm font-semibold text-[var(--sea-ink)]"
                >
                  {header.isPlaceholder ? null : (
                    <button
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--lagoon-deep)]"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-40" />
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--line)] transition-colors hover:bg-[var(--link-bg-hover)]"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
