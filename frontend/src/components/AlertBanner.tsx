import { useEffect } from 'react'

export default function AlertBanner({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, 10_000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div className="flex items-center justify-between bg-orange-600 text-white text-sm px-4 py-2.5 shrink-0">
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-4 text-white/70 hover:text-white text-base leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
