import type { AdminRoad } from '../../types'

type Props = {
  roads: AdminRoad[]
  isLoading: boolean
}

export default function RoadPanel({ roads: _roads, isLoading: _isLoading }: Props) {
  return (
    <div className="p-4 border-b border-gray-800">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Roads</p>
      <p className="text-gray-600 text-xs">Closure list — coming next step</p>
    </div>
  )
}
