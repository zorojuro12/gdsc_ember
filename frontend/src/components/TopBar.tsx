type EvacStatus = 'ORDER' | 'ALERT' | 'WATCH'

const STATUS_STYLES: Record<EvacStatus, string> = {
  ORDER: 'bg-red-600 text-white',
  ALERT: 'bg-orange-500 text-white',
  WATCH: 'bg-yellow-400 text-gray-900',
}

function FlameIcon() {
  return (
    <svg className="w-5 h-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
    </svg>
  )
}

export default function TopBar({ status = 'ORDER' }: { status?: EvacStatus }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
      <div className="flex items-center gap-2">
        <FlameIcon />
        <span className="text-white font-bold text-lg tracking-widest">EMBER</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[status]}`}>
          EVACUATION {status}
        </span>
        <a href="/admin" target="_blank" rel="noopener noreferrer" className="text-gray-500 text-xs hover:text-gray-300 transition-colors">
          Admin
        </a>
      </div>
    </div>
  )
}
