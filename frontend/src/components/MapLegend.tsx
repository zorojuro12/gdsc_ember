export default function MapLegend() {
  return (
    <div className="absolute bottom-8 left-2 z-10 bg-gray-900/80 backdrop-blur-md rounded-lg p-2.5 shadow-lg border border-white/10 text-[11px] text-gray-300 w-44 pointer-events-none">
      <p className="font-semibold uppercase tracking-wider text-gray-500 mb-2 text-[10px]">
        Legend
      </p>

      <div className="space-y-1">
        {/* Fire */}
        <Row label="Fire perimeter">
          <div className="w-3.5 h-3.5 rounded-sm border border-[#A32D2D] bg-[#E24B4A] opacity-60 flex-shrink-0" />
        </Row>

        {/* Spread projections */}
        <Row label="+2hr spread">
          <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#D85A30', opacity: 0.55 }} />
        </Row>
        <Row label="+4hr spread">
          <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#D85A30', opacity: 0.38 }} />
        </Row>
        <Row label="+6hr spread">
          <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#D85A30', opacity: 0.25 }} />
        </Row>

        {/* Evacuation zones */}
        <Row label="Evac order">
          <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#E24B4A', opacity: 0.45 }} />
        </Row>
        <Row label="Evac alert">
          <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#EF9F27', opacity: 0.35 }} />
        </Row>

        {/* Roads */}
        <Row label="Road closed">
          <DashedLine color="#E24B4A" />
        </Row>
        <Row label="Road advisory">
          <DashedLine color="#EF9F27" />
        </Row>

        {/* Shelters */}
        <Row label="Shelter open">
          <Dot color="#639922" />
        </Row>
        <Row label="Shelter filling">
          <Dot color="#EF9F27" />
        </Row>
        <Row label="Shelter near full">
          <Dot color="#E24B4A" />
        </Row>

        {/* Wind */}
        <Row label="Wind: 42 km/h NE">
          <span className="text-xs leading-none flex-shrink-0 text-orange-400 font-bold" style={{ display: 'inline-block', transform: 'rotate(45deg)' }}>
            ›
          </span>
        </Row>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center justify-center w-4 flex-shrink-0">{children}</div>
      <span className="leading-tight">{label}</span>
    </div>
  )
}

function DashedLine({ color }: { color: string }) {
  return (
    <div className="w-4 h-0 flex-shrink-0" style={{ borderTop: `2px dashed ${color}` }} />
  )
}

function Dot({ color }: { color: string }) {
  return (
    <div
      className="w-3 h-3 rounded-full border-[1.5px] border-white/20 flex-shrink-0 shadow-sm"
      style={{ backgroundColor: color }}
    />
  )
}
