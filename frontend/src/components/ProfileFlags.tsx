import type { ProfileFlags } from '../types'

const FLAG_LABELS: { key: keyof ProfileFlags; label: string }[] = [
  { key: 'mobility', label: 'Mobility' },
  { key: 'medical', label: 'Medical' },
  { key: 'pets', label: 'Pets' },
  { key: 'no_vehicle', label: 'No Vehicle' },
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
      {FLAG_LABELS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            flags[key]
              ? 'bg-orange-600 border-orange-600 text-white'
              : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
