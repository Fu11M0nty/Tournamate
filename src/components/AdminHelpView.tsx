/* eslint-disable react/no-unescaped-entities */
'use client'

import { useState } from 'react'

interface HelpStep {
  id: string
  title: string
  description: string
  content: React.ReactNode
  panel: string
}

const HELP_STEPS: HelpStep[] = [
  {
    id: 'general',
    title: '1. General Settings',
    description: 'Master the fundamentals of your tournament identity.',
    panel: 'general',
    content: (
      <div className="space-y-6">
        <section>
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Setting Your Tournament Identity</h4>
          <p className="mt-2">The General Settings panel is the "brain" of your tournament. Everything you configure here affects the public-facing branding and the core logic of your event.</p>
        </section>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">Key Configurations:</h5>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Tournament Name:</strong> Choose a name that is clear and recognizable. This appears in browser tabs, social media previews, and at the top of every public page.</li>
            <li><strong>The Slug (URL):</strong> This is your tournament's unique web address (e.g., <code>tournamate.com/summer-slam-2026</code>). Keep it short, lowercase, and avoid special characters.</li>
            <li><strong>Status Management:</strong> 
              <ul className="list-circle pl-5 mt-1 space-y-1 text-sm">
                <li><span className="text-amber-600 font-bold uppercase text-[10px]">Upcoming:</span> Visible to the public but marked as "Coming Soon". Perfect for registration periods.</li>
                <li><span className="text-emerald-600 font-bold uppercase text-[10px]">Live:</span> The tournament is active. Results and standings are featured prominently.</li>
                <li><span className="text-zinc-500 font-bold uppercase text-[10px]">Complete:</span> Archive mode. Great for historical reference of past winners.</li>
              </ul>
            </li>
          </ul>
        </section>

        <section className="rounded-lg bg-zinc-50 p-4 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
          <h5 className="font-bold text-sm uppercase tracking-wider text-zinc-500">💡 Pro Tip: Branding</h5>
          <p className="text-sm mt-1">Upload a high-resolution logo in the General panel. We recommend a PNG with a transparent background so it looks great on both light and dark themes.</p>
        </section>

        <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 italic">
          [Screenshot: General Settings Panel highlighting Name, Slug, and Status]
        </div>
      </div>
    )
  },
  {
    id: 'divisions',
    title: '2. Divisions & Teams',
    description: 'Organize your competition into age groups and categories.',
    panel: 'age-groups',
    content: (
      <div className="space-y-6">
        <section>
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Structuring Your Competition</h4>
          <p className="mt-2">Divisions (or Age Groups) are independent "mini-tournaments" within your event. Teams in one division never play teams in another, and their standings are calculated separately.</p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-zinc-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <h5 className="font-bold text-tm-orange text-sm uppercase">Step 1: Add Divisions</h5>
            <p className="text-sm mt-1 text-zinc-600 dark:text-zinc-400">Define your categories (e.g., U11 Girls, Open Mixed). Assign them to a specific day of your tournament.</p>
          </div>
          <div className="p-4 rounded-lg border border-zinc-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <h5 className="font-bold text-tm-orange text-sm uppercase">Step 2: Add Teams</h5>
            <p className="text-sm mt-1 text-zinc-600 dark:text-zinc-400">Inside each division, add your teams. You can enter them manually one-by-one or use the Bulk Import tool.</p>
          </div>
        </div>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">The "Bulk Import" Workflow:</h5>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Download the <strong>CSV Template</strong> from the Bulk Import panel.</li>
            <li>Fill in your team names and their assigned division slugs.</li>
            <li>Paste the CSV data back into the portal and click "Process".</li>
            <li>Review for any errors (like misspelled division names) and click "Confirm".</li>
          </ol>
        </section>

        <section className="rounded-lg bg-tm-orange/5 p-4 border border-tm-orange/20">
          <h5 className="font-bold text-sm uppercase tracking-wider text-tm-orange">⚠️ Common Pitfall</h5>
          <p className="text-sm mt-1 italic text-zinc-700 dark:text-zinc-300">"Why aren&apos;t my teams showing in the standings?" — Ensure you have assigned teams to a Pool within the Format builder. Teams must be active in the format to appear in public tables.</p>
        </section>

        <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 italic">
          [Screenshot: Divisions List with 'Add Team' and 'Bulk Import' highlighted]
        </div>
      </div>
    )
  },
  {
    id: 'structure',
    title: '3. Format',
    description: 'Design complex formats with Pools and Brackets.',
    panel: 'structure',
    content: (
      <div className="space-y-6">
        <section>
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">The Logic of Play</h4>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">The Format panel is where you define how teams compete, qualify, and decide a winner. You can mix and match stages to create professional-grade formats.</p>
        </section>

        <div className="space-y-4">
          <div className="border-l-4 border-tm-navy pl-4 py-1">
            <h5 className="font-bold">Phase 1: Pool Stage (Round Robin)</h5>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Teams are split into groups (Pool A, Pool B). Every team plays everyone else in their pool. Points are awarded based on your custom <strong>Scoring System</strong>.</p>
          </div>

          <div className="border-l-4 border-tm-orange pl-4 py-1">
            <h5 className="font-bold">Phase 2: Elimination (Brackets)</h5>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Create Quarter-finals, Semi-finals, and Finals. Use <strong>Progression Rules</strong> to automatically move the "Winner of Pool A" and "Runner up of Pool B" into the bracket slots.</p>
          </div>
        </div>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">How to Build a Progression:</h5>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Create your Bracket Phase and add "Finals" elements.</li>
            <li>Edit a "Slot" in the bracket. Change its type to <strong>"Source"</strong>.</li>
            <li>Select the Pool Phase as the source, and choose the <strong>Rank</strong> (e.g., 1st Place).</li>
            <li>TournaMate will automatically "resolve" these placeholders once the pool games are finished and scores are entered.</li>
          </ol>
        </section>

        <section className="rounded-lg bg-zinc-50 p-4 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
          <h5 className="font-bold text-sm uppercase tracking-wider text-zinc-500">💡 Pro Tip: Byes</h5>
          <p className="text-sm mt-1">If you have an odd number of teams, use the "Bye" slot type. The opposing team will automatically receive a walkthrough to the next round.</p>
        </section>

        <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 italic">
          [Screenshot: Format Builder showing pools linked to a knockout round]
        </div>
      </div>
    )
  },
  {
    id: 'schedule',
    title: '4. Scheduling',
    description: 'Master the Timeline with Drag-and-Drop.',
    panel: 'schedule',
    content: (
      <div className="space-y-6">
        <section>
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Managing Your Timeline</h4>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">The Scheduler is a high-performance drag-and-drop tool that handles the complex math of timing and court availability.</p>
        </section>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">Core Concepts:</h5>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Courts:</strong> Define how many courts you have available. You can rename them (e.g., "Show Court", "Court 1") and set their operating hours.</li>
            <li><strong>Unplanned Fixtures:</strong> On the left, you&apos;ll see all matches generated by your format that haven&apos;t been scheduled yet.</li>
            <li><strong>The Grid:</strong> Drag an unplanned fixture onto a court and a time slot. The system will automatically snap it to the nearest 5-minute interval.</li>
          </ul>
        </section>

        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:bg-rose-950/20 dark:border-rose-900/30">
          <h5 className="font-bold text-sm uppercase tracking-wider text-rose-600">Conflict Detection</h5>
          <p className="text-sm mt-1 text-rose-800 dark:text-rose-300">TournaMate automatically highlights <strong>Back-to-Back conflicts</strong>. If a team is scheduled to play two games with less than 20 minutes of rest (customizable), the match card will glow red on the grid.</p>
        </section>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">The "Auto-Plan" Feature:</h5>
          <p className="text-sm">Feeling overwhelmed? Use the <strong>Auto-Plan</strong> button. Tell the system which courts to use and what time to start, and it will intelligently pack your fixtures to minimize gaps and ensure fair rest times for all teams.</p>
        </section>

        <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 italic">
          [Screenshot: Schedule Grid showing match cards, court labels, and a conflict warning]
        </div>
      </div>
    )
  },
  {
    id: 'officiating',
    title: '5. Officiating',
    description: 'Registry, Rosters, and Role Assignments.',
    panel: 'officiating',
    content: (
      <div className="space-y-6">
        <section>
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Professional Official Management</h4>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Never lose track of who is blowing the whistle. TournaMate features a global registry and match-level assignments.</p>
        </section>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
            <h5 className="font-bold">1. The Global Registry</h5>
            <p className="text-sm mt-1">Register Umpires and Clubs once. They are saved to your account and can be "hired" for any of your tournaments. This saves hours of data entry for recurring events.</p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
            <h5 className="font-bold">2. Tournament Rosters</h5>
            <p className="text-sm mt-1">From the Registry, assign specific officials to your current tournament. This creates your "available pool" for assignments.</p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700">
            <h5 className="font-bold">3. Match Assignments</h5>
            <p className="text-sm mt-1">Go to the <strong>Match Entry</strong> panel and click the whistle icon on any fixture. Assign specific roles:
              <span className="block mt-1 text-[11px] font-mono text-zinc-500 uppercase tracking-tighter">Head / Assistant / Scorer / Assessor</span>
            </p>
          </div>
        </div>

        <section className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30">
          <h5 className="font-bold text-sm uppercase tracking-wider text-emerald-600">The "No-Show" Rule</h5>
          <p className="text-sm mt-1 text-emerald-800 dark:text-emerald-300">If your tournament rules penalize teams for failing to provide an umpire, use the <strong>Umpire No-Show</strong> toggle in the Score Entry form. This automatically deducts points from the offending team in the standings.</p>
        </section>

        <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 italic">
          [Screenshot: Official Assignment Dialog showing role selection]
        </div>
      </div>
    )
  },
  {
    id: 'live',
    title: '6. Going Live & Results',
    description: 'Score Capture and Real-Time Ops.',
    panel: 'match-entry',
    content: (
      <div className="space-y-6">
        <section>
          <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Managing Game Day</h4>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">On the day of the event, the Match Entry panel becomes your command center. Speed and accuracy are the priorities here.</p>
        </section>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">Score Entry Workflows:</h5>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Admin Entry:</strong> Click any match card to open the score form. Enter the final score and click "Save". Standings are recalculated <strong>instantly</strong>.</li>
            <li><strong>QR Scorecards:</strong> Each match has a unique QR code. Print these out or show them on a tablet. Officials can scan the code to enter scores from their own smartphones—no login required!</li>
            <li><strong>Late Start / No Show:</strong> Track match delays directly in the form. This data is saved for your post-tournament report.</li>
          </ul>
        </section>

        <section className="rounded-lg border border-tm-navy/20 bg-tm-navy/5 p-4">
          <h5 className="font-bold text-sm uppercase tracking-wider text-tm-navy">Audit Trail (Snapshots)</h5>
          <p className="text-sm mt-1 italic">"What if I make a mistake?" — Use the <strong>Snapshots</strong> tool. We recommend taking a snapshot before starting each new phase (e.g., 'End of Pools'). If a result is disputed or data is lost, you can restore your tournament to that exact point in time.</p>
        </section>

        <section className="space-y-3">
          <h5 className="font-bold text-tm-navy dark:text-zinc-200">Public Display:</h5>
          <p className="text-sm">Encourage teams and spectators to visit your public tournament URL. They can follow their favorite teams, view live tables, and see upcoming fixtures in real-time. The "Live" badge will appear next to games currently in progress.</p>
        </section>

        <div className="aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-100 flex items-center justify-center text-zinc-400 italic">
          [Screenshot: Match Entry Panel with QR codes and 'Live' standings visible]
        </div>
      </div>
    )
  }
]

export default function AdminHelpView() {
  const [activeStep, setActiveStep] = useState(HELP_STEPS[0].id)

  const currentStep = HELP_STEPS.find(s => s.id === activeStep)!

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="text-3xl font-black text-tm-navy dark:text-zinc-50 tracking-tight italic">
          ADMIN <span className="text-tm-orange">HELP CENTER</span>
        </h2>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400 font-medium">The comprehensive guide to building, scheduling, and running your tournament.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <nav className="md:col-span-4 space-y-2 sticky top-4">
          <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Setup Roadmap
          </p>
          {HELP_STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={[
                'w-full text-left px-4 py-4 rounded-xl transition-all border flex items-start gap-4',
                activeStep === step.id 
                  ? 'bg-white border-tm-orange shadow-lg ring-1 ring-tm-orange/20 dark:bg-zinc-900' 
                  : 'bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              ].join(' ')}
            >
              <span className={[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border',
                activeStep === step.id ? 'bg-tm-orange border-tm-orange text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700'
              ].join(' ')}>
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className={[
                  'font-bold text-sm leading-tight truncate',
                  activeStep === step.id ? 'text-tm-navy dark:text-white' : 'text-zinc-700'
                ].join(' ')}>
                  {step.title.split('. ')[1]}
                </div>
                <div className={[
                  'text-[11px] mt-1 leading-tight line-clamp-2',
                  activeStep === step.id ? 'text-zinc-500' : 'text-zinc-400'
                ].join(' ')}>
                  {step.description}
                </div>
              </div>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="md:col-span-8 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden dark:bg-zinc-950 dark:border-zinc-800">
          <div className="bg-zinc-50 border-b border-zinc-200 px-8 py-6 dark:bg-zinc-900/50 dark:border-zinc-800">
            <h3 className="text-2xl font-black text-tm-navy dark:text-zinc-50 tracking-tight">{currentStep.title}</h3>
            <p className="text-zinc-500 mt-1 font-medium italic">{currentStep.description}</p>
          </div>
          
          <div className="p-8">
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              {currentStep.content}
            </div>

            <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider">Located in: {currentStep.panel} Panel</span>
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                {HELP_STEPS.indexOf(currentStep) > 0 && (
                  <button 
                    onClick={() => setActiveStep(HELP_STEPS[HELP_STEPS.indexOf(currentStep) - 1].id)}
                    className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Back
                  </button>
                )}
                {HELP_STEPS.indexOf(currentStep) < HELP_STEPS.length - 1 && (
                  <button 
                    onClick={() => setActiveStep(HELP_STEPS[HELP_STEPS.indexOf(currentStep) + 1].id)}
                    className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-full bg-tm-orange text-white hover:bg-tm-orange-dark shadow-tm-orange/20 shadow-lg transition-all hover:-translate-y-0.5"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Support Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        <div className="rounded-2xl bg-tm-navy p-8 border border-tm-navy-dark shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <svg className="h-24 w-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.222c0 5.613-4.554 10.163-10.164 10.163-5.613 0-10.164-4.55-10.164-10.163 0-5.614 4.551-10.163 10.164-10.163 5.61 0 10.164 4.549 10.164 10.163zm-11.854-4.965v9.84l7.63-4.92-7.63-4.92z"/></svg>
          </div>
          <h4 className="font-black text-white text-xl tracking-tight italic">VIDEO TUTORIALS</h4>
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed">Watch our step-by-step masterclass on building professional tournaments in under 30 minutes.</p>
          <button className="mt-6 inline-flex items-center gap-2 text-tm-orange font-bold text-xs uppercase tracking-widest hover:text-tm-orange-light transition-colors">
            Start Watching 
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <h4 className="font-black text-tm-navy dark:text-zinc-50 text-xl tracking-tight italic uppercase">Direct Support</h4>
          <p className="text-zinc-500 mt-2 text-sm leading-relaxed dark:text-zinc-400">Stuck on a complex progression rule or custom scoring system? Our expert team is available for live 1-on-1 walkthroughs.</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <button className="px-5 py-2 rounded-full bg-zinc-100 text-zinc-900 font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-colors dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">Open Live Chat</button>
            <button className="px-5 py-2 rounded-full border border-zinc-200 text-zinc-600 font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">Schedule a Call</button>
          </div>
        </div>
      </div>
    </div>
  )
}
