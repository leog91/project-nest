export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t border-[var(--line)] px-4 pb-14 pt-10 text-center text-sm text-[var(--sea-ink-soft)]">
      <div className="page-wrap">
        <p className="m-0">
          &copy; {year} leog91 · Built with TanStack
        </p>
      </div>
    </footer>
  )
}
