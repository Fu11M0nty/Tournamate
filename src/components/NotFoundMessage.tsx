import Link from 'next/link'

interface NotFoundMessageProps {
  title: string
  description?: string
}

export default function NotFoundMessage({
  title,
  description,
}: NotFoundMessageProps) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        TournaMate
      </p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-full bg-tm-orange px-5 py-2 text-sm font-semibold text-white hover:bg-tm-orange-dark"
      >
        Back to home
      </Link>
    </main>
  )
}
