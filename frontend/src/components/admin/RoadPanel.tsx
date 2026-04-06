import type { AdminRoad } from '../../types'

const STATUS_BADGE: Record<string, string> = {
  CLOSED:   'bg-red-900/60 text-red-300 border border-red-700/60',
  ADVISORY: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/60',
  OPEN:     'bg-green-900/60 text-green-300 border border-green-700/60',
}

const DOT_STYLES: Record<string, string> = {
  CLOSED:   'bg-red-500',
  ADVISORY: 'bg-yellow-400',
  OPEN:     'bg-green-500',
}

type Props = {
  roads: AdminRoad[]
  isLoading: boolean
}

export default function RoadPanel({ roads, isLoading }: Props) {
  return (
    <div className="p-4">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Roads</p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : roads.length === 0 ? (
        <p className="text-gray-600 text-xs">No active road events</p>
      ) : (
        <ul className="space-y-2">
          {roads.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[r.status] ?? 'bg-gray-500'}`} />
                <span className="text-gray-300 text-sm truncate">{r.road}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[r.status] ?? 'bg-gray-800 text-gray-400'}`}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
