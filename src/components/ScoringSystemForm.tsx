'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { SPORTS, type ScoringSystem } from '@/lib/types'

const PRESETS = {
  Netball: {
    sport_type: 'Netball',
    win_pts: 5, draw_pts: 3, loss_pts: 0,
    bonus_loss_pts: 1, bonus_loss_threshold_type: 'percentage', bonus_loss_threshold_value: 50,
    forfeit_win_pts: 5, forfeit_loss_pts: 0, forfeit_win_score_for: 5, forfeit_win_score_against: 0,
    tie_breaker_config: ['goal_difference', 'goals_for', 'head_to_head'],
  },
  Football: {
    sport_type: 'Football',
    win_pts: 3, draw_pts: 1, loss_pts: 0,
    bonus_loss_pts: 0, bonus_loss_threshold_type: '', bonus_loss_threshold_value: 0,
    forfeit_win_pts: 3, forfeit_loss_pts: 0, forfeit_win_score_for: 3, forfeit_win_score_against: 0,
    tie_breaker_config: ['goal_difference', 'goals_for', 'head_to_head'],
  }
}

const TIE_BREAKER_OPTIONS = [
  { value: 'goal_difference', label: 'Overall Goal Difference' },
  { value: 'goals_for', label: 'Overall Goals Scored' },
  { value: 'goals_against', label: 'Overall Goals Against (Lower is better)' },
  { value: 'wins', label: 'Total Wins' },
  { value: 'head_to_head', label: 'Head-to-Head Points' },
  { value: 'head_to_head_goal_difference', label: 'Head-to-Head Goal Difference' },
  { value: 'head_to_head_goals_for', label: 'Head-to-Head Goals Scored' }
]

export default function ScoringSystemForm({
  initialData = null,
  onSuccess,
  onCancel
}: {
  initialData?: ScoringSystem | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    sport_type: initialData?.sport_type || 'Netball',
    win_pts: initialData?.win_pts ?? 3,
    draw_pts: initialData?.draw_pts ?? 1,
    loss_pts: initialData?.loss_pts ?? 0,
    bonus_loss_pts: initialData?.bonus_loss_pts ?? 0,
    bonus_loss_threshold_type: initialData?.bonus_loss_threshold_type || '',
    bonus_loss_threshold_value: initialData?.bonus_loss_threshold_value || 0,
    forfeit_win_pts: initialData?.forfeit_win_pts ?? 3,
    forfeit_loss_pts: initialData?.forfeit_loss_pts ?? 0,
    forfeit_win_score_for: initialData?.forfeit_win_score_for ?? 3,
    forfeit_win_score_against: initialData?.forfeit_win_score_against ?? 0,
    tie_breaker_config: initialData?.tie_breaker_config || ['goal_difference', 'goals_for', 'head_to_head'],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const applyPreset = (sport: keyof typeof PRESETS) => {
    setFormData(prev => ({ ...prev, ...PRESETS[sport], name: `${sport} Standard` }))
  }

  const moveRule = (index: number, direction: 'up' | 'down') => {
    const newConfig = [...formData.tie_breaker_config]
    if (direction === 'up' && index > 0) {
      [newConfig[index - 1], newConfig[index]] = [newConfig[index], newConfig[index - 1]]
    } else if (direction === 'down' && index < newConfig.length - 1) {
      [newConfig[index + 1], newConfig[index]] = [newConfig[index], newConfig[index + 1]]
    }
    setFormData({ ...formData, tie_breaker_config: newConfig })
  }

  const removeRule = (index: number) => {
    setFormData({ ...formData, tie_breaker_config: formData.tie_breaker_config.filter((_, i) => i !== index) })
  }

  const addRule = () => {
    setFormData({ ...formData, tie_breaker_config: [...formData.tie_breaker_config, 'goal_difference'] })
  }

  const updateRule = (index: number, value: string) => {
    const newConfig = [...formData.tie_breaker_config]
    newConfig[index] = value
    setFormData({ ...formData, tie_breaker_config: newConfig })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      ...formData,
      bonus_loss_threshold_type: formData.bonus_loss_threshold_type || null,
      bonus_loss_threshold_value: formData.bonus_loss_threshold_value || null,
    }

    if (initialData?.id) {
      await supabase.from('scoring_systems').update(payload).eq('id', initialData.id)
    } else {
      await supabase.from('scoring_systems').insert([payload])
    }

    setIsSubmitting(false)
    onSuccess()
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 max-w-2xl w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#1a2d4f]">{initialData ? 'Edit' : 'Create'} Scoring System</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => applyPreset('Netball')} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200">Netball Preset</button>
          <button type="button" onClick={() => applyPreset('Football')} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200">Football Preset</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Name</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="e.g., Junior Netball (5-3-1)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport Type</label>
            <select required value={formData.sport_type} onChange={e => setFormData({ ...formData, sport_type: e.target.value })} className="w-full border rounded p-2 text-sm">
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-semibold text-sm mb-3">Match Points</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Win Points</label>
              <input type="number" required value={formData.win_pts} onChange={e => setFormData({ ...formData, win_pts: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Draw Points</label>
              <input type="number" required value={formData.draw_pts} onChange={e => setFormData({ ...formData, draw_pts: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loss Points</label>
              <input type="number" required value={formData.loss_pts} onChange={e => setFormData({ ...formData, loss_pts: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-semibold text-sm mb-3">Losing Bonus Rules</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bonus Points</label>
              <input type="number" value={formData.bonus_loss_pts} onChange={e => setFormData({ ...formData, bonus_loss_pts: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Threshold Type</label>
              <select value={formData.bonus_loss_threshold_type} onChange={e => setFormData({ ...formData, bonus_loss_threshold_type: e.target.value })} className="w-full border rounded p-2 text-sm">
                <option value="">None</option>
                <option value="percentage">Percentage (e.g., &gt;50%)</option>
                <option value="goals">Goal Margin (e.g., ≤ 5)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Threshold Value</label>
              <input type="number" value={formData.bonus_loss_threshold_value} onChange={e => setFormData({ ...formData, bonus_loss_threshold_value: Number(e.target.value) })} disabled={!formData.bonus_loss_threshold_type} className="w-full border rounded p-2 text-sm disabled:bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-semibold text-sm mb-3">Forfeit Defaults</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Win Pts</label>
              <input type="number" required value={formData.forfeit_win_pts} onChange={e => setFormData({ ...formData, forfeit_win_pts: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loss Pts</label>
              <input type="number" required value={formData.forfeit_loss_pts} onChange={e => setFormData({ ...formData, forfeit_loss_pts: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Score For</label>
              <input type="number" required value={formData.forfeit_win_score_for} onChange={e => setFormData({ ...formData, forfeit_win_score_for: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Score Agst</label>
              <input type="number" required value={formData.forfeit_win_score_against} onChange={e => setFormData({ ...formData, forfeit_win_score_against: Number(e.target.value) })} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">Tie-Breaker Hierarchy</h3>
            <button type="button" onClick={addRule} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Rule</button>
          </div>
          <div className="space-y-2">
            {formData.tie_breaker_config.map((rule, index) => (
              <div key={index} className="flex gap-2 items-center bg-white p-2 border rounded shadow-sm">
                <span className="text-xs font-bold text-gray-400 w-5 text-center">{index + 1}.</span>
                <select value={rule} onChange={e => updateRule(index, e.target.value)} className="flex-1 border border-gray-300 rounded text-sm p-1.5 focus:border-orange-500 focus:outline-none">
                  {TIE_BREAKER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveRule(index, 'up')} disabled={index === 0} className="px-2 py-1 bg-gray-100 border rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveRule(index, 'down')} disabled={index === formData.tie_breaker_config.length - 1} className="px-2 py-1 bg-gray-100 border rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => removeRule(index)} className="px-2 py-1 bg-red-50 border border-red-200 rounded text-red-600 hover:bg-red-100">×</button>
                </div>
              </div>
            ))}
            {formData.tie_breaker_config.length === 0 && (
              <p className="text-sm text-gray-500 italic py-2">No tie-breaker rules added. Teams will be sorted alphabetically.</p>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-3">Rules are evaluated from top to bottom when teams are tied on points.</p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50 text-sm font-medium">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#f47c20] text-white rounded hover:bg-orange-600 disabled:opacity-50 text-sm font-medium">
            {isSubmitting ? 'Saving...' : 'Save Scoring System'}
          </button>
        </div>
      </form>
    </div>
  )
}