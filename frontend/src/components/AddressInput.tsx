import { useEffect, useRef, useState } from 'react'

// Address input with Google Places Autocomplete when available, plain text fallback otherwise.
export default function AddressInput({ onSubmit }: { onSubmit: (address: string) => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const initAutocomplete = () => {
      if (!window.google?.maps?.places) return

      const ac = new google.maps.places.Autocomplete(el, {
        types: ['address'],
        componentRestrictions: { country: 'ca' },
        fields: ['formatted_address'],
      })

      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(49.80, -119.70),
        new google.maps.LatLng(49.95, -119.45),
      )
      ac.setBounds(bounds)

      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const addr = place?.formatted_address
        if (addr) {
          setValue(addr)
          onSubmit(addr)
        }
      })

      autocompleteRef.current = ac
    }

    if (window.google?.maps?.places) {
      initAutocomplete()
    } else {
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(check)
          initAutocomplete()
        }
      }, 500)
      const timeout = setTimeout(() => clearInterval(check), 10000)
      return () => {
        clearInterval(check)
        clearTimeout(timeout)
      }
    }
  }, [onSubmit])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="1598 Westlake Rd, West Kelowna, BC"
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
