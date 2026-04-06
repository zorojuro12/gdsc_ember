import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Map from '../components/Map'
import SituationPanel from '../components/admin/SituationPanel'
import RoadPanel from '../components/admin/RoadPanel'
import ShelterPanel from '../components/admin/ShelterPanel'
import SimControls from '../components/admin/SimControls'
import { useAdminSituation } from '../hooks/useAdminSituation'
import { useAppConfig } from '../contexts/AppConfigContext'
import { API_BASE } from '../lib/api'
import type { AdminShelter } from '../types'

export default function AdminView() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useAdminSituation()
  const config = useAppConfig()

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

  async function handleAdvanceTime() {
    await fetch(`${API_BASE}/api/admin/simulate/advance`, { method: 'POST' })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
  }

  async function handleReset() {
    await fetch(`${API_BASE}/api/admin/simulate/reset`, { method: 'POST' })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
  }

  const isDemo = config?.demoMode ?? true

  const shelterStatusMap: Record<string, string> = {}
  data?.shelters.forEach(s => { shelterStatusMap[s.id] = s.status })

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col">
      {/* Admin header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-widest">EMBER</span>
          <span className="text-gray-500 text-sm">Admin Dashboard</span>
          {isDemo ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-700 text-gray-400 uppercase tracking-wider">
              Demo
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider animate-pulse">
              Live
            </span>
          )}
        </div>
        <Link to="/" className="text-gray-400 text-sm hover:text-white transition-colors">
          ← Resident View
        </Link>
      </div>

      {/* Main layout — map left 60%, panels right 40% */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-[3] overflow-hidden">
          <Map shelterStatuses={shelterStatusMap} />
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
            timelineStep={data?.timeline_step ?? 1}
            maxStep={data?.max_step ?? 4}
            currentTime={data?.updated_at ?? ''}
            activeClosures={data?.active_closure_ids ?? []}
            onAdvanceTime={handleAdvanceTime}
            onTriggerClosure={handleTriggerClosure}
            onReset={handleReset}
          />
        </div>
      </div>
    </div>
  )
}
