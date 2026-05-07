'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type JsQRFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: string },
) => { data: string } | null

interface Props {
  onClose: () => void
}

type Phase = 'init' | 'scanning' | 'file-fallback' | 'manual-only'

export default function QRScannerModal({ onClose }: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const jsQRRef = useRef<JsQRFn | null>(null)
  const detectedRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('init')
  const [cameraErrorMsg, setCameraErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [fileError, setFileError] = useState('')

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const navigate = useCallback(
    (url: string) => {
      if (detectedRef.current) return
      detectedRef.current = true
      stopCamera()
      onClose()
      try {
        const parsed = new URL(url)
        router.push(parsed.pathname + parsed.search)
      } catch {
        router.push(url)
      }
    },
    [stopCamera, onClose, router],
  )

  const tick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const jsQR = jsQRRef.current
    if (!video || !canvas || !jsQR) return
    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const result = jsQR(img.data, img.width, img.height, {
      inversionAttempts: 'dontInvert',
    })
    if (result) {
      const text = result.data.trim()
      const isFullUrl = text.includes('/admin/c/')
      const isCode = /^[A-Za-z0-9]{8}$/.test(text) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)

      if (isFullUrl) {
        navigate(text)
        return
      } else if (isCode) {
        navigate(`/admin/c/${text}`)
        return
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [navigate])

  useEffect(() => {
    let cancelled = false

    async function start() {
      // Load jsQR — needed for both live scanning and file decoding
      try {
        const mod = await import('jsqr')
        if (cancelled) return
        jsQRRef.current = mod.default as JsQRFn
      } catch {
        if (!cancelled) setPhase('manual-only')
        return
      }

      // getUserMedia requires a secure context (HTTPS or localhost)
      const isSecure =
        typeof window !== 'undefined' &&
        (window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1')

      if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraErrorMsg(
            'Live camera requires HTTPS. Use "Take photo" to scan instead.',
          )
          setPhase('file-fallback')
        }
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setPhase('scanning')
        rafRef.current = requestAnimationFrame(tick)
      } catch (err) {
        if (cancelled) return
        const name = err instanceof Error ? err.name : ''
        const msg =
          name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access in your browser settings, or use "Take photo" below.'
            : name === 'NotFoundError'
              ? 'No camera found on this device.'
              : err instanceof Error
                ? `Camera error: ${err.message}`
                : 'Camera unavailable.'
        setCameraErrorMsg(msg)
        setPhase('file-fallback')
      }
    }

    start()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [tick, stopCamera])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file || !jsQRRef.current) return

    try {
      // Draw image to canvas and decode
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not load image'))
      })

      const offscreen = document.createElement('canvas')
      offscreen.width = img.naturalWidth
      offscreen.height = img.naturalHeight
      const ctx = offscreen.getContext('2d')
      if (!ctx) throw new Error('Canvas not available')
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)
      const result = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      })

      if (result) {
        const text = result.data.trim()
        const isFullUrl = text.includes('/admin/c/')
        const isCode = /^[A-Za-z0-9]{8}$/.test(text) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)

        if (isFullUrl) {
          navigate(text)
        } else if (isCode) {
          navigate(`/admin/c/${text}`)
        } else {
          setFileError(`QR found but not a scorecard code: ${result.data}`)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      } else {
        setFileError('No QR code detected in that image. Try again with better lighting.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read image')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const code = manualCode.trim().toUpperCase()
    if (!code) return
    router.push(`/admin/c/${code}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Scan scorecard QR
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 p-4">
          {(phase === 'init' || phase === 'scanning') && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              {phase === 'init' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-zinc-400 dark:bg-zinc-950">
                  Starting camera…
                </div>
              )}
              {phase === 'scanning' && (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-44 w-44 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  </div>
                  <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
                    Hold QR code steady inside the frame
                  </p>
                </>
              )}
            </div>
          )}

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera error explanation */}
          {(phase === 'file-fallback' || phase === 'manual-only') &&
            cameraErrorMsg && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-300">
                {cameraErrorMsg}
              </p>
            )}

          {/* Photo capture fallback — works even without HTTPS */}
          {phase === 'file-fallback' && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Take a photo of the QR code
              </p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-mk-red hover:bg-mk-red/5 hover:text-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-mk-red dark:hover:text-mk-red">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                  />
                </svg>
                Open camera
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {fileError && (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-300">
                  {fileError}
                </p>
              )}
            </div>
          )}

          {/* Manual entry — always shown */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {phase === 'scanning' ? 'Or enter code manually' : 'Enter match code'}
            </p>
            <form onSubmit={submitManual} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) =>
                  setManualCode(
                    e.target.value
                      .replace(/[^A-Za-z0-9]/g, '')
                      .toUpperCase()
                      .slice(0, 8),
                  )
                }
                placeholder="e.g. A1B2C3D4"
                maxLength={8}
                autoCapitalize="characters"
                spellCheck={false}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={manualCode.length < 4}
                className="rounded-md bg-mk-red px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-mk-red/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Go
              </button>
            </form>
            <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              8-character code printed beneath the QR on each scorecard.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
