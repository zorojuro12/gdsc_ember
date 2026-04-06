import type { ReactElement } from 'react'
import type { ProfileFlags } from '../types'

function WheelchairIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="4" r="2"/>
      <path d="M10.5 7h3L15 13h4v2h-5l-1.5-4H10l-1.5 4H4v-2h4.5L10.5 7zM9 17a3 3 0 1 0 6 0H9z"/>
    </svg>
  )
}

function MedicalIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14H8v-4h4v-4h4v4h-4v4z"/>
    </svg>
  )
}

function PawIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="4.5" cy="9" r="2"/>
      <circle cx="9" cy="7" r="2"/>
      <circle cx="15" cy="7" r="2"/>
      <circle cx="19.5" cy="9" r="2"/>
      <path d="M12 12c-3 0-6 2-6 5 0 1.7 1.2 3 3 3h6c1.8 0 3-1.3 3-3 0-3-3-5-6-5z"/>
    </svg>
  )
}

function WalkIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="13" cy="4" r="2"/>
      <path d="M14.5 8l-2 3.5L9 10l-3 5h2.5l2-3 3 2.5V20h2v-6.5l-2.5-2.5 1-2.5L15 11h3V9l-3.5-1z"/>
    </svg>
  )
}

const FLAG_CONFIG: { key: keyof ProfileFlags; label: string; Icon: () => ReactElement }[] = [
  { key: 'mobility',   label: 'Mobility',   Icon: WheelchairIcon },
  { key: 'medical',    label: 'Medical',    Icon: MedicalIcon },
  { key: 'pets',       label: 'Pets',       Icon: PawIcon },
  { key: 'no_vehicle', label: 'No Vehicle', Icon: WalkIcon },
]

export default function ProfileFlags({
  flags,
  onToggle,
}: {
  flags: ProfileFlags
  onToggle: (key: keyof ProfileFlags) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FLAG_CONFIG.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            flags[key]
              ? 'bg-orange-600 border-orange-600 text-white'
              : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'
          }`}
        >
          <Icon />
          {label}
        </button>
      ))}
    </div>
  )
}
