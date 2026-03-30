import { useState } from 'react'

export default function AddressInput({ onSubmit }: { onSubmit: (address: string) => void }) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Enter your address..."
        className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 placeholder-gray-500 focus:outline-none focus:border-orange-500"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        GO
      </button>
    </form>
  )
}
