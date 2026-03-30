type Props = {
  onAdvanceTime: (hours: number) => void
  onTriggerClosure: (closureId: string) => void
  onReset: () => void
}

export default function SimControls({ onAdvanceTime: _onAdvanceTime, onTriggerClosure: _onTriggerClosure, onReset: _onReset }: Props) {
  return (
    <div className="p-4">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Simulation</p>
      <p className="text-gray-600 text-xs">Simulation controls — coming next step</p>
    </div>
  )
}
