'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { Day } from '@/lib/types'

interface PrintButtonProps {
  tournamentSlug: string
  divisionName: string
  day: Day
  label?: string
}

function sanitizeFilenameSegment(s: string): string {
  return s
    .replace(/['"]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function PrintButton({
  tournamentSlug,
  divisionName,
  day,
  label = 'Download PDF',
}: PrintButtonProps) {
  const [generating, setGenerating] = useState(false)

  async function handleDownload() {
    const target = document.querySelector<HTMLElement>('[data-pdf-root]')
    if (!target) {
      toast.error('Nothing to export.')
      return
    }

    setGenerating(true)
    const hidden = Array.from(
      target.querySelectorAll<HTMLElement>('[data-print-hide]')
    )
    const previousDisplay = hidden.map((el) => el.style.display)
    hidden.forEach((el) => {
      el.style.display = 'none'
    })

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])

      const blocks = Array.from(
        target.querySelectorAll<HTMLElement>('[data-pdf-block]')
      )
      if (blocks.length === 0) {
        toast.error('Nothing to export.')
        return
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24
      const usableWidth = pageWidth - 2 * margin
      const usableHeight = pageHeight - 2 * margin
      const blockGap = 8
      let cursorY = margin
      let firstOnPage = true

      for (const block of blocks) {
        const canvas = await html2canvas(block, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.85)
        const imgHeight = (canvas.height * usableWidth) / canvas.width

        if (imgHeight > usableHeight) {
          // Block is taller than a full page — slice it across pages.
          if (!firstOnPage) {
            pdf.addPage()
          }
          let drawn = 0
          while (drawn < imgHeight) {
            if (drawn > 0) pdf.addPage()
            pdf.addImage(
              imgData,
              'JPEG',
              margin,
              margin - drawn,
              usableWidth,
              imgHeight
            )
            drawn += usableHeight
          }
          cursorY = margin
          firstOnPage = true
          continue
        }

        if (!firstOnPage && cursorY + imgHeight > margin + usableHeight) {
          pdf.addPage()
          cursorY = margin
          firstOnPage = true
        }

        pdf.addImage(imgData, 'JPEG', margin, cursorY, usableWidth, imgHeight)
        cursorY += imgHeight + blockGap
        firstOnPage = false
      }

      const dayLabel = day === 'saturday' ? 'Saturday' : 'Sunday'
      const filename = `MK-Netters-and-MK-Dons-${sanitizeFilenameSegment(
        tournamentSlug
      )}-${dayLabel}-${sanitizeFilenameSegment(divisionName)}.pdf`
      pdf.save(filename)
    } catch (err) {
      toast.error(
        err instanceof Error ? `PDF failed: ${err.message}` : 'PDF failed'
      )
    } finally {
      hidden.forEach((el, i) => {
        el.style.display = previousDisplay[i]
      })
      setGenerating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={generating}
      title="Download this division's standings, results and fixtures as a PDF"
      className="print:hidden inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path d="M5 21h14" />
      </svg>
      {generating ? 'Generating…' : label}
    </button>
  )
}
