import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'
import type { AdminSituationResponse } from '../types'

export function useAdminSituation() {
  return useQuery<AdminSituationResponse>({
    queryKey: ['admin-situation'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/situation`)
      if (!res.ok) throw new Error('Failed to fetch situation')
      return res.json()
    },
    refetchInterval: 30_000, // 30 seconds
    retry: 1,
  })
}
