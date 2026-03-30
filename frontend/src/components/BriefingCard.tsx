import type { BriefingResponse, SpreadRate, ShelterStatus } from '../types'

const SPREAD_STYLES: Record<SpreadRate, string> = {
  LOW: 'bg-green-900 text-green-300',
  MODERATE: 'bg-yellow-900 text-yellow-300',
  HIGH: 'bg-orange-900 text-orange-300',
  EXTREME: 'bg-red-900 text-red-300',
}

const SHELTER_STYLES: Record<ShelterStatus, string> = {
  Open: 'bg-green-900 text-green-300',
  Filling: 'bg-orange-900 text-orange-300',
  'Near Full': 'bg-red-900 text-red-300',
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
      {children}
    </p>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      <div className="h-3.5 bg-gray-700 rounded w-3/4" />
      <div className="h-3.5 bg-gray-700 rounded w-full" />
      <div className="h-3.5 bg-gray-700 rounded w-5/6" />
    </div>
  )
}

export default function BriefingCard({
  data,
  isLoading,
  isError,
}: {
  data: BriefingResponse | undefined
  isLoading: boolean
  isError: boolean
}) {
  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 space-y-5">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 text-center">
        <p className="text-gray-400 text-sm">
          Unable to load briefing. Check your connection and try again.
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 text-center">
        <p className="text-gray-500 text-sm">
          Enter your address above to get your evacuation briefing.
        </p>
      </div>
    )
  }

  const { threat, route, shelter, closures, briefing_text, updated_at } = data

  return (
    <div className="bg-gray-900 rounded-xl divide-y divide-gray-800 overflow-hidden">
      {/* LLM briefing text */}
      <div className="p-4">
        <p className="text-white text-sm leading-relaxed">{briefing_text}</p>
      </div>

      {/* Threat */}
      <div className="p-4">
        <SectionLabel>Threat</SectionLabel>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white text-sm">{threat.distance_km} km away</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${SPREAD_STYLES[threat.spread_rate]}`}>
            {threat.spread_rate}
          </span>
        </div>
        <p className="text-gray-400 text-sm">
          Reaches your area in ~{threat.time_to_perimeter_hours}h &middot; Wind{' '}
          {threat.wind.speed_kmh} km/h {threat.wind.direction}
        </p>
      </div>

      {/* Route */}
      <div className="p-4">
        <SectionLabel>Route</SectionLabel>
        <p className="text-white text-sm font-medium">{route.summary}</p>
        <p className="text-gray-400 text-sm mt-0.5">
          {route.distance_km} km &middot; {route.duration_min} min
        </p>
        <p className="text-gray-500 text-xs mt-1">Fallback: {route.fallback_summary}</p>
      </div>

      {/* Shelter */}
      <div className="p-4">
        <SectionLabel>Shelter</SectionLabel>
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-white text-sm font-medium">{shelter.name}</p>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${SHELTER_STYLES[shelter.status]}`}>
            {shelter.status}
          </span>
        </div>
        <p className="text-gray-400 text-sm">{shelter.address}</p>
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          {shelter.is_accessible && <span>Accessible</span>}
          {shelter.has_pet_area && <span>Pet-friendly</span>}
        </div>
      </div>

      {/* Road closures */}
      {closures.length > 0 && (
        <div className="p-4">
          <SectionLabel>Road Closures</SectionLabel>
          <ul className="space-y-1.5">
            {closures.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-gray-300">{c.road}</span>
                <span className="text-red-400 text-xs ml-auto">{c.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      <div className="px-4 py-2.5">
        <p className="text-gray-600 text-[11px]">
          Updated{' '}
          {new Date(updated_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
