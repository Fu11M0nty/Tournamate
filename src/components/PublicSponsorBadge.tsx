import type { TournamentBranding } from '@/lib/branding'

interface PublicSponsorBadgeProps {
  branding: TournamentBranding
  className?: string
}

export default function PublicSponsorBadge({
  branding,
  className = '',
}: PublicSponsorBadgeProps) {
  if (!branding.hasSponsor) return null

  const label = branding.sponsorName ?? 'Tournament sponsor'
  const content = (
    <>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
        Supported by
      </span>
      {branding.sponsorLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.sponsorLogoUrl}
          alt=""
          className="h-7 max-w-28 object-contain"
          loading="lazy"
        />
      )}
      <span className="max-w-52 truncate text-xs font-bold text-white">
        {label}
      </span>
    </>
  )

  const classes = [
    'inline-flex max-w-full items-center gap-2 rounded-md border bg-white/8 px-3 py-2 ring-1 ring-white/10 backdrop-blur',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const style = {
    borderColor: `${branding.primaryColor}66`,
  }

  if (branding.sponsorUrl) {
    return (
      <a
        href={branding.sponsorUrl}
        target="_blank"
        rel="noreferrer"
        className={classes}
        style={style}
      >
        {content}
      </a>
    )
  }

  return (
    <div className={classes} style={style}>
      {content}
    </div>
  )
}
