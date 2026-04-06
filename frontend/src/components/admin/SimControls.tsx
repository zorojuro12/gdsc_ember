import { useState } from 'react'

const ALL_CLOSURE_IDS = ['closure_004', 'closure_001', 'closure_002', 'closure_003']

const CLOSURE_LABELS: Record<string, string> = {
  closure_001: 'Westside Road',
  closure_002: 'Hwy 97 (travel advisory)',
  closure_003: 'Rose Valley access roads',
  closure_004: 'Bear Creek Road',
}

const TIMELINE_STEPS = [
  { id: 1, time: '7:00 PM',  label: 'Westside Rd closed' },
  { id: 2, time: '8:00 PM',  label: 'Hwy 97 advisory' },
  { id: 3, time: '9:00 PM',  label: 'Rose Valley order' },
  { id: 4, time: '9:55 PM',  label: 'Fire jumps lake' },
]

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

  const validSelected = inactiveClosures.includes(selectedClosure) ? selectedClosure : inactiveClosures[0] ?? ''

  function handleTrigger() {
    if (validSelected) onTriggerClosure(validSelected)
  }

  const atLastStep = timelineStep >= maxStep

  return (
    <div className="p-4">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Simulation</p>

      {/* Visual timeline track */}
      <div className="bg-gray-900 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Timeline</p>
          <p className="text-gray-400 text-xs font-mono">{formatSimTime(currentTime)}</p>
        </div>

        {/* Step dots + connecting lines */}
        <div className="relative flex items-center mb-2">
          {TIMELINE_STEPS.map((step, i) => {
            const isCompleted = step.id < timelineStep
            const isCurrent   = step.id === timelineStep
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className={`w-3 h-3 rounded-full shrink-0 border-2 transition-all duration-300 ${
                  isCompleted ? 'bg-orange-500 border-orange-500' :
                  isCurrent   ? 'bg-orange-400 border-orange-400 ring-2 ring-orange-500/30' :
                                'bg-gray-700 border-gray-600'
                }`} />
                {i < TIMELINE_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 transition-all duration-300 ${
                    isCompleted ? 'bg-orange-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step labels */}
        <div className="flex items-start">
          {TIMELINE_STEPS.map((step) => {
            const isCurrent = step.id === timelineStep
            const isFuture  = step.id > timelineStep
            return (
              <div key={step.id} className="flex-1 last:flex-none pr-1">
                <p className={`text-[9px] font-mono leading-tight ${
                  isCurrent ? 'text-orange-400' :
                  isFuture  ? 'text-gray-600' :
                              'text-gray-500'
                }`}>
                  {step.time}
                </p>
                <p className={`text-[8px] leading-tight mt-0.5 ${
                  isCurrent ? 'text-gray-300' :
                  isFuture  ? 'text-gray-700' :
                              'text-gray-600'
                }`}>
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
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
          {atLastStep ? 'End of Timeline' : 'Advance to Next Step →'}
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
