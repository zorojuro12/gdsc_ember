import type { AdminShelter, ShelterStatus } from '../../types'

const STATUS_BADGE: Record<ShelterStatus, string> = {
  Open:       'bg-green-900 text-green-300',
  Filling:    'bg-orange-900 text-orange-300',
  'Near Full':'bg-red-900 text-red-300',
}

const OVERRIDE_BUTTONS: ShelterStatus[] = ['Open', 'Filling', 'Near Full']

const OVERRIDE_ACTIVE: Record<ShelterStatus, string> = {
  Open:       'bg-green-700 text-white',
  Filling:    'bg-orange-600 text-white',
  'Near Full':'bg-red-700 text-white',
}

const OVERRIDE_INACTIVE = 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'

type Props = {
  shelters: AdminShelter[]
  isLoading: boolean
  onStatusChange: (id: string, status: ShelterStatus) => void
}

export default function ShelterPanel({ shelters, isLoading, onStatusChange }: Props) {
  return (
    <div className="p-4 border-b border-gray-800">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Shelters</p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : shelters.length === 0 ? (
        <p className="text-gray-600 text-xs">No shelter data</p>
      ) : (
        <ul className="space-y-3">
          {shelters.map((s) => (
            <li key={s.id} className="bg-gray-900 rounded-lg p-3">
              {/* Name + status badge */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium leading-tight">{s.name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ml-2 ${STATUS_BADGE[s.status]}`}>
                  {s.status}
                </span>
              </div>

              {/* Capacity + icons */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-gray-500 text-xs">~{s.capacity_estimate} cap</span>
                {s.is_accessible && <span className="text-gray-500 text-xs">· Accessible</span>}
                {s.has_pet_area && <span className="text-gray-500 text-xs">· Pets</span>}
                {s.has_medical_power && <span className="text-gray-500 text-xs">· Medical pwr</span>}
              </div>

              {/* Override buttons */}
              <div className="flex gap-1">
                {OVERRIDE_BUTTONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(s.id, status)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                      s.status === status ? OVERRIDE_ACTIVE[status] : OVERRIDE_INACTIVE
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
