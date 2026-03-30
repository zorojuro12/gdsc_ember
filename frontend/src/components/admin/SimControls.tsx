import { useState } from 'react'

// All closure IDs defined in the scenario, in timeline order.
const ALL_CLOSURE_IDS = ['closure_004', 'closure_001', 'closure_002', 'closure_003']

const CLOSURE_LABELS: Record<string, string> = {
  closure_001: 'Westside Road',
  closure_002: 'Hwy 97 (travel advisory)',
  closure_003: 'Rose Valley access roads',
  closure_004: 'Bear Creek Road',
}

type Props = {
  timelineStep: number
  maxStep: number
  currentTime: string
  activeClosures: string[]
  onAdvanceTime: () => void
  onTriggerClosure: (closureId: string) => void
  onReset: () => void
}

function formatSimTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function SimControls({
  timelineStep,
  maxStep,
  currentTime,
  activeClosures,
  onAdvanceTime,
  onTriggerClosure,
  onReset,
}: Props) {
  const inactiveClosures = ALL_CLOSURE_IDS.filter(id => !activeClosures.includes(id))
  const [selectedClosure, setSelectedClosure] = useState<string>('')

  // Keep selectedClosure valid when active closures change
  const validSelected = inactiveClosures.includes(selectedClosure) ? selectedClosure : inactiveClosures[0] ?? ''

  function handleTrigger() {
    if (validSelected) onTriggerClosure(validSelected)
  }

  const atLastStep = timelineStep >= maxStep

  return (
    <div className="p-4">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Simulation</p>

      {/* Current sim time */}
      <div className="bg-gray-900 rounded-lg p-3 mb-3">
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Demo Time</p>
        <p className="text-white text-sm font-semibold">{formatSimTime(currentTime)}</p>
        <p className="text-gray-600 text-xs mt-0.5">Step {timelineStep} of {maxStep}</p>
      </div>

      {/* Trigger closure */}
      <div className="mb-3">
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Trigger Closure</p>
        {inactiveClosures.length === 0 ? (
          <p className="text-gray-600 text-xs py-1">All closures active</p>
        ) : (
          <div className="flex gap-2">
            <select
              value={validSelected}
              onChange={e => setSelectedClosure(e.target.value)}
              className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-gray-500"
            >
              {inactiveClosures.map(id => (
                <option key={id} value={id}>{CLOSURE_LABELS[id] ?? id}</option>
              ))}
            </select>
            <button
              onClick={handleTrigger}
              className="bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors shrink-0"
            >
              Trigger
            </button>
          </div>
        )}
      </div>

      {/* Advance + Reset */}
      <div className="flex gap-2">
        <button
          onClick={onAdvanceTime}
          disabled={atLastStep}
          className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-semibold px-3 py-2 rounded transition-colors"
        >
          {atLastStep ? 'End of Timeline' : 'Advance to Next Step'}
        </button>
        <button
          onClick={onReset}
          className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold px-3 py-2 rounded transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
