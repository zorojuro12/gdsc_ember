import type { AdminSituationResponse } from '../../types'

type Props = {
  data: AdminSituationResponse | undefined
  isLoading: boolean
}

export default function SituationPanel({ data: _data, isLoading: _isLoading }: Props) {
  return (
    <div className="p-4 border-b border-gray-800">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Situation</p>
      <p className="text-gray-600 text-xs">Metric cards — coming next step</p>
    </div>
  )
}
