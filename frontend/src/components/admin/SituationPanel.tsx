import type { AdminSituationResponse, SpreadRate } from '../../types'

const SPREAD_STYLES: Record<SpreadRate, { badge: string; label: string }> = {
  LOW:     { badge: 'bg-green-900/60 text-green-300 border border-green-700/60',   label: 'Low' },
  MODERATE:{ badge: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/60', label: 'Moderate' },
  HIGH:    { badge: 'bg-orange-900/60 text-orange-300 border border-orange-700/60', label: 'High' },
  EXTREME: { badge: 'bg-red-900/60 text-red-300 border border-red-700/60',           label: 'Extreme' },
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800/60">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</p>
      <div className="text-white text-sm font-semibold font-mono">{children}</div>
    </div>
  )
}

function Skeleton() {
  return <div className="h-14 bg-gray-800/60 rounded-lg animate-pulse border border-gray-800" />
}

type Props = {
  data: AdminSituationResponse | undefined
  isLoading: boolean
}

export default function SituationPanel({ data, isLoading }: Props) {
  return (
    <div className="p-4">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Situation</p>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-white text-sm font-semibold">{data.fire.name} Fire</p>
            <span className="text-gray-600 text-xs">{data.fire.id}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Perimeter">
              {data.fire.hectares.toLocaleString()} ha
            </MetricCard>

            <MetricCard label="Spread Rate">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SPREAD_STYLES[data.fire.spread_rate].badge}`}>
                {SPREAD_STYLES[data.fire.spread_rate].label}
              </span>
            </MetricCard>

            <MetricCard label="Wind">
              {data.fire.wind.speed_kmh} km/h {data.fire.wind.direction}
            </MetricCard>

            <MetricCard label="Last Updated">
              <span className="font-mono text-gray-300 text-xs">
                {new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </MetricCard>
          </div>
        </>
      )}
    </div>
  )
}
