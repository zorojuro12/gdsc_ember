import type { AdminShelter } from '../../types'

type Props = {
  shelters: AdminShelter[]
  isLoading: boolean
  onStatusChange: (id: string, status: AdminShelter['status']) => void
}

export default function ShelterPanel({ shelters: _shelters, isLoading: _isLoading, onStatusChange: _onStatusChange }: Props) {
  return (
    <div className="p-4 border-b border-gray-800">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Shelters</p>
      <p className="text-gray-600 text-xs">Status overrides — coming next step</p>
    </div>
  )
}
