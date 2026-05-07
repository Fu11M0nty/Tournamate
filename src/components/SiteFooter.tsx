import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-tm-navy text-white/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div className="sm:col-span-1">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80">
              <svg viewBox="0 0 320 205" className="h-24 w-auto" aria-label="TournaMate" role="img">
                <defs>
                  <filter id="footer-shadow">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.3"/>
                  </filter>
                </defs>
                <svg x="90" y="8" width="144" height="125" viewBox="420 0 560 500" overflow="hidden">
                  <image href="/Tournamate-removebg-preview2.svg" x="0" y="0" width="1436" height="696"/>
                </svg>
                <text transform="translate(1.5,1.5)" y="178" textAnchor="middle" fontFamily="Nunito, Poppins, 'Arial Rounded MT Bold', system-ui, sans-serif" fontWeight="900" fontSize="40">
                  <tspan x="160" fill="#1a4a6e">Tourna</tspan><tspan fill="#7a3a08">Mate</tspan>
                </text>
                <text transform="translate(0.75,0.75)" y="178" textAnchor="middle" fontFamily="Nunito, Poppins, 'Arial Rounded MT Bold', system-ui, sans-serif" fontWeight="900" fontSize="40">
                  <tspan x="160" fill="#2d6a9e">Tourna</tspan><tspan fill="#b85510">Mate</tspan>
                </text>
                <text y="178" textAnchor="middle" fontFamily="Nunito, Poppins, 'Arial Rounded MT Bold', system-ui, sans-serif" fontWeight="900" fontSize="40" filter="url(#footer-shadow)">
                  <tspan x="160" fill="#4a9fd4">Tourna</tspan><tspan fill="#f47c20">Mate</tspan>
                </text>
              </svg>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              The tournament platform for grassroots sport. Live standings, results and fixtures for every competition.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/30">Platform</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/explore" className="hover:text-white transition-colors">Explore tournaments</Link></li>
              <li><Link href="/register-interest" className="hover:text-white transition-colors">For organisers</Link></li>
              <li><Link href="/admin/login" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Organiser sign in</Link></li>
            </ul>
          </div>

          {/* Sports */}
          <div>
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/30">Sports</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/explore?sport=Netball" className="hover:text-white transition-colors">Netball</Link></li>
              <li><Link href="/explore?sport=Football" className="hover:text-white transition-colors">Football</Link></li>
              <li><Link href="/explore?sport=Basketball" className="hover:text-white transition-colors">Basketball</Link></li>
              <li><Link href="/explore" className="hover:text-white transition-colors">All sports →</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 flex flex-col items-center justify-between gap-3 text-xs sm:flex-row">
          <p className="text-white/30">© {new Date().getFullYear()} TournaMate. Powering grassroots sport.</p>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-tm-orange" />
            <span className="text-white/30">Live results &amp; standings</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
