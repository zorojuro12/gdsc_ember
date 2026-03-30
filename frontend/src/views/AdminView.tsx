import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Map from '../components/Map'
import SituationPanel from '../components/admin/SituationPanel'
import RoadPanel from '../components/admin/RoadPanel'
import ShelterPanel from '../components/admin/ShelterPanel'
import SimControls from '../components/admin/SimControls'
import { useAdminSituation } from '../hooks/useAdminSituation'
import { API_BASE } from '../lib/api'
import type { AdminShelter } from '../types'

export default function AdminView() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useAdminSituation()

  async function handleStatusChange(id: string, status: AdminShelter['status']) {
    await fetch(`${API_BASE}/api/admin/shelter/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
  }

  async function handleTriggerClosure(closureId: string) {
    await fetch(`${API_BASE}/api/admin/simulate/closure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closure_id: closureId }),
    })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
  }

  async function handleAdvanceTime(hours: number) {
    await fetch(`${API_BASE}/api/admin/simulate/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
  }

  async function handleReset() {
    await fetch(`${API_BASE}/api/admin/simulate/reset`, { method: 'POST' })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
  }

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col">
      {/* Admin header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-widest">EMBER</span>
          <span className="text-gray-500 text-sm">Admin Dashboard</span>
        </div>
        <Link
          to="/"
          className="text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← Resident View
        </Link>
      </div>

      {/* Main layout — map left 60%, panels right 40% */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-[3] overflow-hidden">
          <Map />
        </div>

        {/* Right panels */}
        <div className="flex-[2] overflow-y-auto border-l border-gray-800 bg-gray-950 divide-y divide-gray-800">
          <SituationPanel data={data} isLoading={isLoading} />
          <RoadPanel roads={data?.roads ?? []} isLoading={isLoading} />
          <ShelterPanel
            shelters={data?.shelters ?? []}
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
          />
          <SimControls
            onAdvanceTime={handleAdvanceTime}
            onTriggerClosure={handleTriggerClosure}
            onReset={handleReset}
          />
        </div>
      </div>
    </div>
  )
}
