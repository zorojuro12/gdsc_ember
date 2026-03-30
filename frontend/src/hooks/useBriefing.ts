import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'
import type { BriefingResponse, ProfileFlags } from '../types'

export function useBriefing(address: string, flags: ProfileFlags) {
  return useQuery<BriefingResponse>({
    queryKey: ['briefing', address, flags],
    queryFn: async () => {
      const params = new URLSearchParams({
        address,
        mobility: String(flags.mobility),
        medical: String(flags.medical),
        pets: String(flags.pets),
        no_vehicle: String(flags.no_vehicle),
      })
      const res = await fetch(`${API_BASE}/api/briefing?${params}`)
      if (!res.ok) throw new Error('Request failed')
      const data: BriefingResponse & { detail?: string } = await res.json()
      if (data.detail) throw new Error(data.detail)
      return data
    },
    enabled: address.length > 0,
    refetchInterval: 300_000, // 5 minutes
    retry: 1,
  })
}
