import type { AdminSituationResponse, SpreadRate } from '../../types'

const SPREAD_STYLES: Record<SpreadRate, { badge: string; label: string }> = {
  LOW:     { badge: 'bg-green-900 text-green-300',  label: 'Low' },
  MODERATE:{ badge: 'bg-yellow-900 text-yellow-300', label: 'Moderate' },
  HIGH:    { badge: 'bg-orange-900 text-orange-300', label: 'High' },
  EXTREME: { badge: 'bg-red-900 text-red-300',       label: 'Extreme' },
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</p>
      <div className="text-white text-sm font-semibold">{children}</div>
    </div>
  )
}

function Skeleton() {
  return <div className="h-14 bg-gray-800 rounded-lg animate-pulse" />
}

type Props = {
  data: AdminSituationResponse | undefined
  isLoading: boolean
}

export default function SituationPanel({ data, isLoading }: Props) {
  return (
    <div className="p-4 border-b border-gray-800">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Situation</p>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : (
        <>
          <p className="text-gray-400 text-xs mb-3">
            {data.fire.name} Fire &middot; <span className="text-gray-500">{data.fire.id}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Perimeter">
              {data.fire.hectares.toLocaleString()} ha
            </MetricCard>

            <MetricCard label="Spread Rate">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${SPREAD_STYLES[data.fire.spread_rate].badge}`}>
                {SPREAD_STYLES[data.fire.spread_rate].label}
              </span>
            </MetricCard>

            <MetricCard label="Wind">
              {data.fire.wind.speed_kmh} km/h {data.fire.wind.direction}
            </MetricCard>

            <MetricCard label="Last Updated">
              {new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </MetricCard>

            <MetricCard label="Under Order">
              <span className="text-red-400">{data.evacuations.under_order.toLocaleString()}</span>
              <span className="text-gray-500 text-xs font-normal ml-1">properties</span>
            </MetricCard>

            <MetricCard label="Under Alert">
              <span className="text-orange-400">{data.evacuations.under_alert.toLocaleString()}</span>
              <span className="text-gray-500 text-xs font-normal ml-1">properties</span>
            </MetricCard>
          </div>
        </>
      )}
    </div>
  )
}
