// Cross-tab communication for admin → resident updates.
// Admin tab sends 'simulation-changed' when state mutates;
// resident tab listens and triggers a React Query refetch.

const CHANNEL_NAME = 'ember-sync'

let _channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (!('BroadcastChannel' in window)) return null
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME)
  return _channel
}

export function notifySimulationChanged(): void {
  getChannel()?.postMessage('simulation-changed')
}

export function onSimulationChanged(callback: () => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const handler = () => callback()
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}
