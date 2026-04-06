import { useState, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Map from '../components/Map'
import TopBar from '../components/TopBar'
import AddressInput from '../components/AddressInput'
import ProfileFlags from '../components/ProfileFlags'
import BriefingCard from '../components/BriefingCard'
import AlertBanner from '../components/AlertBanner'
import { useBriefing } from '../hooks/useBriefing'
import { onSimulationChanged } from '../lib/broadcast'
import type { ProfileFlags as ProfileFlagsType } from '../types'

const FLAGS_KEY = 'ember_profile_flags'

const DEFAULT_FLAGS: ProfileFlagsType = {
  mobility: false,
  medical: false,
  pets: false,
  no_vehicle: false,
}

function loadFlags(): ProfileFlagsType {
  try {
    const stored = localStorage.getItem(FLAGS_KEY)
    return stored ? { ...DEFAULT_FLAGS, ...JSON.parse(stored) } : DEFAULT_FLAGS
  } catch {
    return DEFAULT_FLAGS
  }
}

export default function ResidentView() {
  const queryClient = useQueryClient()
  const [address, setAddress] = useState('')
  const [flags, setFlags] = useState<ProfileFlagsType>(loadFlags)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)

  // Listen for admin tab simulation changes → refetch briefing instantly
  useEffect(() => {
    return onSimulationChanged(() => {
      void queryClient.invalidateQueries({ queryKey: ['briefing'] })
    })
  }, [queryClient])

  // Persist flags to localStorage on every change
  useEffect(() => {
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flags))
  }, [flags])

  const handleToggle = useCallback((key: keyof ProfileFlagsType) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const { data, isLoading, isError } = useBriefing(address, flags)

  // Detect route changes between polls — show banner only after first successful load
  const prevRouteSummary = useRef<string | null>(null)
  const prevClosureRoads = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!data?.route) return

    const currentSummary = data.route.summary
    const currentClosureRoads = new Set(data.closures.map(c => c.road))

    if (prevRouteSummary.current !== null && prevRouteSummary.current !== currentSummary) {
      const newClosures = data.closures.filter(c => !prevClosureRoads.current.has(c.road))
      const msg =
        newClosures.length > 0
          ? `Route updated — ${newClosures[0].road} now ${newClosures[0].status.toLowerCase()}`
          : `Route updated — ${currentSummary}`
      setBannerMessage(msg)
    }

    prevRouteSummary.current = currentSummary
    prevClosureRoads.current = currentClosureRoads
  }, [data])

  return (
    <div className="w-full bg-gray-950 flex flex-col lg:h-screen">
      <TopBar />
      <AlertBanner message={bannerMessage} onDismiss={() => setBannerMessage(null)} />
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:overflow-hidden">
        {/* Map — left column on desktop, full width on mobile */}
        <div className="lg:flex-1 lg:overflow-hidden">
          <Map routePolyline={data?.route?.polyline ?? null} userLocation={data?.user_location ?? null} />
        </div>
        {/* Right panel — below map on mobile, sidebar on desktop */}
        <div className="lg:w-[380px] lg:overflow-y-auto lg:border-l lg:border-gray-800 p-4 space-y-4">
          <AddressInput onSubmit={setAddress} />
          <ProfileFlags flags={flags} onToggle={handleToggle} />
          <BriefingCard data={data} isLoading={isLoading} isError={isError} />
        </div>
      </div>
    </div>
  )
}
