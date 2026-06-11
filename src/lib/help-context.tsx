'use client'

import { createContext, useContext } from 'react'

export interface HelpNavigation {
  /** Switch the admin console to the Help panel, opened at the given guide slug. */
  openHelpGuide: (slug: string) => void
}

const HelpNavigationContext = createContext<HelpNavigation | null>(null)

export const HelpNavigationProvider = HelpNavigationContext.Provider

/**
 * Null outside the admin console (e.g. capture pages reuse some admin
 * components) — consumers like HelpPrompt render nothing in that case.
 */
export function useHelpNavigation(): HelpNavigation | null {
  return useContext(HelpNavigationContext)
}
