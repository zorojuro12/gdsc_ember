import type { BriefingResponse, SpreadRate, ShelterStatus } from '../types'

const SPREAD_ACCENT: Record<SpreadRate, string> = {
  LOW:      'border-green-500',
  MODERATE: 'border-yellow-400',
  HIGH:     'border-orange-500',
  EXTREME:  'border-red-500',
}

const SPREAD_TEXT: Record<SpreadRate, string> = {
  LOW:      'text-green-400',
  MODERATE: 'text-yellow-300',
  HIGH:     'text-orange-400',
  EXTREME:  'text-red-400',
}

const SPREAD_BADGE: Record<SpreadRate, string> = {
  LOW:      'bg-green-900/60 text-green-300 border border-green-700/60',
  MODERATE: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/60',
  HIGH:     'bg-orange-900/60 text-orange-300 border border-orange-700/60',
  EXTREME:  'bg-red-900/60 text-red-300 border border-red-700/60',
}

const SHELTER_BADGE: Record<ShelterStatus, string> = {
  Open:       'bg-green-900/60 text-green-300 border border-green-700/60',
  Filling:    'bg-orange-900/60 text-orange-300 border border-orange-700/60',
  'Near Full':'bg-red-900/60 text-red-300 border border-red-700/60',
  Full:       'bg-red-950/60 text-red-400 border border-red-800/60',
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
      {children}
    </p>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-24 bg-gray-800 rounded-xl" />
      <div className="bg-gray-900 rounded-xl p-4 space-y-2.5">
        <div className="h-3 bg-gray-800 rounded w-1/3" />
        <div className="h-3.5 bg-gray-800 rounded w-full" />
        <div className="h-3.5 bg-gray-800 rounded w-5/6" />
        <div className="h-3.5 bg-gray-800 rounded w-4/5" />
      </div>
    </div>
  )
}

export default function BriefingCard({
  data,
  isLoading,
  isError,
  userAddress,
}: {
  data: BriefingResponse | undefined
  isLoading: boolean
  isError: boolean
  userAddress?: string
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900/60 rounded-xl p-4 text-center border border-gray-800">
          <p className="text-gray-400 text-sm animate-pulse">
            EMBER is analyzing your situation...
          </p>
        </div>
        <Skeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
        <p className="text-gray-400 text-sm">
          Unable to load briefing. Check your connection and try again.
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-5 text-center border border-dashed border-gray-700">
        <p className="text-gray-400 text-sm leading-relaxed">
          Enter your address above to receive your evacuation briefing.
        </p>
      </div>
    )
  }

  const { threat, route, shelter, closures, briefing_text, updated_at } = data

  // Use geocoded lat/lng from backend as origin — avoids Google Maps re-geocoding
  // the text address and picking the wrong city.
  const originParam = data.user_location
    ? `${data.user_location.lat},${data.user_location.lng}`
    : (userAddress ?? '')
  const mapsUrl = shelter && originParam
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(shelter.address)}`
    : null

  const accentClass = threat ? SPREAD_ACCENT[threat.spread_rate] : 'border-orange-500'
  const textClass   = threat ? SPREAD_TEXT[threat.spread_rate]   : 'text-orange-400'

  return (
    <div className="space-y-3">

      {/* ── Threat Hero ─────────────────────────────────────────── */}
      {threat && (
        <div className={`bg-gray-900 rounded-xl border-l-4 ${accentClass}`}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className={`font-mono text-5xl font-bold leading-none tracking-tight ${textClass}`}>
                  {Math.round(threat.time_to_perimeter_hours * 60)}
                </p>
                <p className="text-gray-400 text-sm mt-1.5">min until fire reaches your area</p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 mt-0.5 ${SPREAD_BADGE[threat.spread_rate]}`}>
                {threat.spread_rate}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800 text-sm text-gray-400">
              <span>
                <span className="font-mono text-white">{threat.distance_km}</span> km away
              </span>
              <span className="text-gray-700">·</span>
              <span>
                Wind <span className="font-mono text-white">{threat.wind.speed_kmh}</span> km/h {threat.wind.direction}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Card ───────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">

        {/* Briefing Text */}
        <div className="p-4">
          <div className="border-l-2 border-orange-500 pl-3">
            <p className="text-orange-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
              EMBER Briefing · Updated{' '}
              {new Date(updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-gray-200 text-sm leading-relaxed">{briefing_text}</p>
          </div>
        </div>

        {/* Route */}
        {route && (
          <div className="p-4">
            <SectionLabel>Route</SectionLabel>
            <p className="text-white text-sm font-medium">{route.summary}</p>
            <p className="text-gray-400 text-sm mt-0.5">
              {route.distance_km != null && (
                <><span className="font-mono">{route.distance_km}</span> km · </>
              )}
              <span className="font-mono">{route.duration_min}</span> min
            </p>
            <p className="text-gray-600 text-xs mt-1.5">Fallback: {route.fallback_summary}</p>
          </div>
        )}

        {/* Shelter */}
        {shelter && (
          <div className="p-4">
            <SectionLabel>Shelter</SectionLabel>
            <div className="flex items-start justify-between mb-1">
              <p className="text-white text-sm font-medium leading-tight">{shelter.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${SHELTER_BADGE[shelter.status]}`}>
                {shelter.status}
              </span>
            </div>
            <p className="text-gray-400 text-xs">{shelter.address}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              {shelter.is_accessible && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="4" r="2"/>
                    <path d="M10 22v-6l-2-3V8h8v5l-2 3v6"/>
                  </svg>
                  Accessible
                </span>
              )}
              {shelter.has_pet_area && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm15 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-4 4c-3 0-6 2-6 5 0 1.5 1 2.5 2.5 2.5h7c1.5 0 2.5-1 2.5-2.5 0-3-3-5-6-5z"/>
                  </svg>
                  Pet-friendly
                </span>
              )}
            </div>
          </div>
        )}

        {/* Road closures */}
        {closures.length > 0 && (
          <div className="p-4">
            <SectionLabel>Road Closures</SectionLabel>
            <ul className="space-y-1.5">
              {closures.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-gray-300">{c.road}</span>
                  <span className="text-red-400 text-xs ml-auto font-semibold">{c.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigate CTA */}
        {mapsUrl && shelter && (
          <div className="p-4 pt-3">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              Navigate to {shelter.name}
              <svg className="w-4 h-4 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
