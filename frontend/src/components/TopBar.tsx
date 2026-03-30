type EvacStatus = 'ORDER' | 'ALERT' | 'WATCH'

const STATUS_STYLES: Record<EvacStatus, string> = {
  ORDER: 'bg-red-600 text-white',
  ALERT: 'bg-orange-500 text-white',
  WATCH: 'bg-yellow-400 text-gray-900',
}

export default function TopBar({ status = 'ORDER' }: { status?: EvacStatus }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
      <span className="text-white font-bold text-lg tracking-widest">EMBER</span>
      <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[status]}`}>
        EVACUATION {status}
      </span>
    </div>
  )
}
