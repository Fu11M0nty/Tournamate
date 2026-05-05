'use client'

import { QRCodeSVG } from 'qrcode.react'
import type { AgeGroup, Match, Team } from '@/lib/types'

interface Props {
  match: Match
  homeTeam: Team
  awayTeam: Team
  ageGroup: AgeGroup
  copy: 'home' | 'away'
  captureUrl: string
}

// For continuous, one unlabelled period still renders the CP checkbox
const PERIOD_LABELS: Record<string, string[]> = {
  halves: ['1ST HALF', '2ND HALF'],
  quarters: ['1ST QTR', '2ND QTR', '3RD QTR', '4TH QTR'],
  continuous: [''],
}

function TeamGoalSection({
  count,
  label,
  side,
}: {
  count: number
  label: string
  side: 'home' | 'away'
}) {
  const chunks: number[][] = []
  for (let i = 0; i < count; i += 5) {
    chunks.push(
      Array.from({ length: Math.min(5, count - i) }, (_, j) => i + j + 1),
    )
  }

  return (
    <div
      style={{
        flex: 1,
        borderRight: side === 'home' ? '0.5pt solid #000' : undefined,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* CP checkbox row — always rendered regardless of period label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2pt 4pt',
          borderBottom: '0.5pt solid #ccc',
          fontSize: '8pt',
          gap: '3pt',
          minHeight: '13pt',
          flexShrink: 0,
        }}
      >
        {side === 'home' ? (
          <>
            <span
              style={{
                fontWeight: 700,
                flex: 1,
                letterSpacing: '0.02em',
                fontSize: '8pt',
              }}
            >
              {label}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>CP&nbsp;&#9744;</span>
          </>
        ) : (
          <>
            <span style={{ whiteSpace: 'nowrap' }}>&#9744;&nbsp;CP</span>
            <span
              style={{
                fontWeight: 700,
                flex: 1,
                textAlign: 'right',
                letterSpacing: '0.02em',
                fontSize: '8pt',
              }}
            >
              {label}
            </span>
          </>
        )}
      </div>

      {/* Numbered goal cells in rows of 5 */}
      <div
        style={{
          padding: '2pt 3pt 3pt',
          fontFamily: 'monospace',
          fontSize: '8pt',
          lineHeight: 1.3,
          flex: 1,
        }}
      >
        {chunks.map((chunk, ri) => (
          <div
            key={ri}
            style={{
              display: 'flex',
              borderBottom:
                ri < chunks.length - 1 ? '0.5pt dashed #bbb' : 'none',
              padding: '1pt 0',
            }}
          >
            {Array.from({ length: 5 }, (_, ci) => (
              <span
                key={ci}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  color: ci < chunk.length ? '#000' : 'transparent',
                }}
              >
                {ci < chunk.length ? chunk[ci] : 0}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ScorecardCard({
  match,
  homeTeam,
  awayTeam,
  ageGroup,
  copy,
  captureUrl,
}: Props) {
  const raw = ageGroup.period_minutes * 3
  const goalCount = Math.ceil(raw / 5) * 5
  const periods = PERIOD_LABELS[ageGroup.match_format] ?? ['']

  const kickoff = new Date(match.kickoff_time)
  const timeStr = kickoff.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const shortId = match.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  const copyTeam = copy === 'home' ? homeTeam : awayTeam
  const bannerBg = copy === 'home' ? '#fce7f3' : '#dbeafe'
  const bannerFg = copy === 'home' ? '#831843' : '#1e3a8a'

  return (
    <div
      style={{
        border: '1pt solid #000',
        backgroundColor: '#fff',
        color: '#000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '9pt',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header: age group + court/time + QR code */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          borderBottom: '0.5pt solid #000',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, padding: '5pt 6pt', minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '14pt',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              lineHeight: 1.1,
            }}
          >
            {ageGroup.name}
            {match.round_number != null && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: '11pt',
                  marginLeft: '8pt',
                }}
              >
                RND {match.round_number}
              </span>
            )}
          </div>
          <div style={{ marginTop: '3pt', fontSize: '10.5pt', color: '#222' }}>
            {match.court && (
              <span>
                COURT: {match.court.replace(/^court\s+/i, '')}
                &nbsp;&nbsp;&nbsp;
              </span>
            )}
            <span>TIME: {timeStr}</span>
            {match.duration_minutes > 0 && (
              <span>&nbsp;&nbsp;({match.duration_minutes}min)</span>
            )}
          </div>
        </div>
        <div
          style={{
            borderLeft: '0.5pt solid #000',
            padding: '3pt 5pt',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2pt',
            flexShrink: 0,
          }}
        >
          <QRCodeSVG value={shortId} size={72} level="M" />
          <span
            style={{ fontFamily: 'monospace', fontSize: '7pt', color: '#555' }}
          >
            {shortId}
          </span>
        </div>
      </div>

      {/* Scorer banner */}
      <div
        style={{
          backgroundColor: bannerBg,
          color: bannerFg,
          fontWeight: 700,
          fontSize: '9pt',
          textAlign: 'center',
          padding: '3pt 0',
          borderBottom: '0.5pt solid #000',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        &rsaquo;&rsaquo; SCORER FOR: {copyTeam.name} (
        {copy === 'home' ? 'HOME' : 'AWAY'}) &lsaquo;&lsaquo;
      </div>

      {/* Team name headers with optional logo */}
      <div
        style={{ display: 'flex', borderBottom: '0.5pt solid #000', flexShrink: 0 }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4pt 5pt',
            borderRight: '0.5pt solid #000',
            gap: '3pt',
          }}
        >
          {homeTeam.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={homeTeam.logo_url}
              alt=""
              style={{ height: '20pt', width: 'auto', objectFit: 'contain' }}
            />
          )}
          <span
            style={{
              fontWeight: 700,
              fontSize: '9pt',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {homeTeam.name} (H)
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4pt 5pt',
            gap: '3pt',
          }}
        >
          {awayTeam.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={awayTeam.logo_url}
              alt=""
              style={{ height: '20pt', width: 'auto', objectFit: 'contain' }}
            />
          )}
          <span
            style={{
              fontWeight: 700,
              fontSize: '9pt',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {awayTeam.name} (A)
          </span>
        </div>
      </div>

      {/* Score sections — each period is a side-by-side pair of columns */}
      {periods.map((label, pi) => (
        <div
          key={pi}
          style={{ display: 'flex', borderBottom: '0.5pt solid #000', flex: 1, minHeight: 0 }}
        >
          <TeamGoalSection count={goalCount} label={label} side="home" />
          <TeamGoalSection count={goalCount} label={label} side="away" />
        </div>
      ))}

      {/* FINAL SCORE — taller box for large number writing */}
      <div
        style={{ display: 'flex', borderBottom: '0.5pt solid #000', flexShrink: 0 }}
      >
        <div
          style={{
            flex: 1,
            padding: '3pt 5pt 5pt',
            borderRight: '0.5pt solid #000',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: '8.5pt',
              marginBottom: '3pt',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Final Score
          </div>
          <div
            style={{
              border: '0.5pt solid #999',
              minHeight: '30pt',
              borderRadius: '1pt',
              backgroundColor: '#fafafa',
            }}
          />
        </div>
        <div style={{ flex: 1, padding: '3pt 5pt 5pt' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '8.5pt',
              marginBottom: '3pt',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            Final Score
          </div>
          <div
            style={{
              border: '0.5pt solid #999',
              minHeight: '30pt',
              borderRadius: '1pt',
              backgroundColor: '#fafafa',
            }}
          />
        </div>
      </div>

      {/* Umpire signature lines */}
      <div
        style={{
          padding: '3pt 5pt',
          display: 'flex',
          gap: '8pt',
          fontSize: '8.5pt',
          flexShrink: 0,
        }}
      >
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3pt' }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>Umpire 1:</span>
          <span
            style={{
              flex: 1,
              borderBottom: '0.5pt solid #000',
              minHeight: '14pt',
              display: 'inline-block',
            }}
          />
        </div>
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3pt' }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>Umpire 2:</span>
          <span
            style={{
              flex: 1,
              borderBottom: '0.5pt solid #000',
              minHeight: '14pt',
              display: 'inline-block',
            }}
          />
        </div>
      </div>
    </div>
  )
}
