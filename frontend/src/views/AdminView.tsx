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
import { notifySimulationChanged } from '../lib/broadcast'
import type { AdminShelter } from '../types'

function FlameIcon() {
  return (
    <svg className="w-4 h-4 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
    </svg>
  )
}

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
    notifySimulationChanged()
  }

  async function handleTriggerClosure(closureId: string) {
    await fetch(`${API_BASE}/api/admin/simulate/closure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closure_id: closureId }),
    })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
    notifySimulationChanged()
  }

  async function handleAdvanceTime() {
    await fetch(`${API_BASE}/api/admin/simulate/advance`, { method: 'POST' })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
    notifySimulationChanged()
  }

  async function handleReset() {
    await fetch(`${API_BASE}/api/admin/simulate/reset`, { method: 'POST' })
    void queryClient.invalidateQueries({ queryKey: ['admin-situation'] })
    notifySimulationChanged()
  }

  const isDemo = config?.demoMode ?? true

  const shelterStatusMap: Record<string, string> = {}
  data?.shelters.forEach(s => { shelterStatusMap[s.id] = s.status })

  const openShelterCount = data?.shelters.filter(s => s.status !== 'Near Full').length ?? 0
  const totalShelters = data?.shelters.length ?? 5

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col">

      {/* Admin header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <FlameIcon />
          <span className="text-white font-bold text-lg tracking-widest">EMBER</span>
          <span className="text-gray-600 text-sm">·</span>
          <span className="text-gray-400 text-sm">Admin Dashboard</span>
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

      {/* KPI Bar */}
      {(data || isLoading) && (
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800 shrink-0 bg-gray-900/50">
          <div className="px-4 py-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Under Order</p>
            <p className="font-mono text-2xl font-bold text-red-400">
              {isLoading ? '—' : data!.evacuations.under_order.toLocaleString()}
            </p>
            <p className="text-gray-600 text-[10px] mt-0.5">properties</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Under Alert</p>
            <p className="font-mono text-2xl font-bold text-orange-400">
              {isLoading ? '—' : data!.evacuations.under_alert.toLocaleString()}
            </p>
            <p className="text-gray-600 text-[10px] mt-0.5">properties</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Shelters Available</p>
            <p className="font-mono text-2xl font-bold text-green-400">
              {isLoading ? '—' : `${openShelterCount}/${totalShelters}`}
            </p>
            <p className="text-gray-600 text-[10px] mt-0.5">not near full</p>
          </div>
        </div>
      )}

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
