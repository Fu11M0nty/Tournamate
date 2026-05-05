'use client'

interface Props {
  label: string
}

export default function ScorecardPrintBar({ label }: Props) {
  return (
    <div
      data-print-hide
      className="print:hidden"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 999,
        background: '#1f2937',
        color: '#fff',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '14px',
      }}
    >
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          background: '#e11d2d',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 18px',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '13px',
        }}
      >
        Print / Save PDF
      </button>
      <a
        href="/admin"
        style={{
          color: '#d1d5db',
          textDecoration: 'none',
          fontSize: '13px',
        }}
      >
        ✕ Close
      </a>
    </div>
  )
}
