'use client'

import { useEffect, useRef, useState } from 'react'
import {
  parsePhotonResponse,
  photonSearchUrl,
  type ParsedAddress,
  type PhotonFeature,
} from '@/lib/addressLookup'

interface AddressAutocompleteProps {
  onSelect: (address: ParsedAddress) => void
  label?: string
  placeholder?: string
  id?: string
}

export default function AddressAutocomplete({
  onSelect,
  label = 'Search address',
  placeholder = 'Start typing an address…',
  id,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ feature: PhotonFeature; parsed: ParsedAddress }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const skipNextSearch = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      try {
        const res = await fetch(photonSearchUrl(q), { signal: controller.signal })
        if (!res.ok) throw new Error('Address lookup failed')
        setResults(parsePhotonResponse(await res.json()))
        setOpen(true)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setFailed(true)
        setResults([])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function choose(parsed: ParsedAddress) {
    onSelect(parsed)
    skipNextSearch.current = true
    setQuery(parsed.label)
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        <input
          id={id}
          type="text"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {loading && (
            <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">Searching…</p>
          )}
          {!loading && failed && (
            <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              Address lookup unavailable — enter the address manually.
            </p>
          )}
          {!loading && !failed && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">No matches found.</p>
          )}
          {results.length > 0 && (
            <ul className="max-h-60 overflow-auto">
              {results.map((result, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => choose(result.parsed)}
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {result.parsed.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-zinc-200 px-3 py-1 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            © OpenStreetMap contributors · Photon
          </p>
        </div>
      )}
    </div>
  )
}
