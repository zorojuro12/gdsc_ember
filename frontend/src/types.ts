export type SpreadRate = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'
export type ShelterStatus = 'Open' | 'Filling' | 'Near Full' | 'Full'

export interface BriefingResponse {
  updated_at: string
  threat: {
    distance_km: number
    time_to_perimeter_hours: number
    spread_rate: SpreadRate
    wind: { speed_kmh: number; direction: string }
  }
  route: {
    summary: string
    distance_km: number
    duration_min: number
    polyline: string
    fallback_summary: string
  }
  shelter: {
    id: string
    name: string
    address: string
    lat: number
    lng: number
    status: ShelterStatus
    is_accessible: boolean
    has_pet_area: boolean
  }
  closures: Array<{
    road: string
    status: string
    lat: number
    lng: number
  }>
  briefing_text: string
  user_location?: { lat: number; lng: number }
  fire_perimeter_geojson: string
  projections_geojson: string[]
}

export interface ProfileFlags {
  mobility: boolean
  medical: boolean
  pets: boolean
  no_vehicle: boolean
}

export interface AdminShelter {
  id: string
  name: string
  status: ShelterStatus
  capacity_estimate: number
  is_accessible: boolean
  has_pet_area: boolean
  has_medical_power: boolean
}

export interface AdminRoad {
  road: string
  status: string
  lat: number
  lng: number
}

export interface AdminSituationResponse {
  fire: {
    id: string
    name: string
    hectares: number
    spread_rate: SpreadRate
    wind: { speed_kmh: number; direction: string }
    perimeter_url: string
  }
  evacuations: {
    under_order: number
    under_alert: number
  }
  roads: AdminRoad[]
  shelters: AdminShelter[]
  updated_at: string
  timeline_step: number
  max_step: number
  active_closure_ids: string[]
}
