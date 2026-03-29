import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

// Degrees per km at West Kelowna latitude (49.86°)
const KM_LAT = 1 / 111
const KM_LNG = 1 / (111 * Math.cos((49.86 * Math.PI) / 180))

// Returns a rectangular GeoJSON polygon expanded bufferKm around the given bounding box.
function bboxPolygon(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
  bufferKm: number,
) {
  const dLat = bufferKm * KM_LAT
  const dLng = bufferKm * KM_LNG
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [minLng - dLng, minLat - dLat],
          [maxLng + dLng, minLat - dLat],
          [maxLng + dLng, maxLat + dLat],
          [minLng - dLng, maxLat + dLat],
          [minLng - dLng, minLat - dLat],
        ],
      ],
    },
    properties: {},
  }
}

type Coord = { lat: number; lng: number }
type RoadClosure = {
  road_name: string
  status: string
  coordinates_from: Coord
  coordinates_to: Coord
}
type Shelter = { name: string; lat: number; lng: number }

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-119.58, 49.86],
      zoom: 11,
    })

    mapRef.current = map

    map.on('load', () => {
      void (async () => {
        const [perimeterRes, closuresRes, sheltersRes] = await Promise.all([
          fetch('/mcdougall_creek_perimeter.geojson'),
          fetch('/road_closures.json'),
          fetch('/shelters.json'),
        ])
        const perimeter = (await perimeterRes.json()) as {
          features: Array<{ geometry: { coordinates: number[][][] } }>
        }
        const closuresData = (await closuresRes.json()) as {
          road_closures: RoadClosure[]
        }
        const sheltersData = (await sheltersRes.json()) as {
          shelters: Shelter[]
        }

        // --- Evacuation zone placeholders ---

        const allCoords = perimeter.features.flatMap((f) =>
          f.geometry.coordinates.flat(),
        )
        const lngs = allCoords.map((c) => c[0])
        const lats = allCoords.map((c) => c[1])
        const bbox: [number, number, number, number] = [
          Math.min(...lngs),
          Math.min(...lats),
          Math.max(...lngs),
          Math.max(...lats),
        ]

        // Evacuation Alert zone (5km buffer) — rendered first, underneath Order zone
        map.addSource('evac-alert', {
          type: 'geojson',
          data: bboxPolygon(...bbox, 5),
        })
        map.addLayer({
          id: 'evac-alert-fill',
          type: 'fill',
          source: 'evac-alert',
          paint: { 'fill-color': '#EF9F27', 'fill-opacity': 0.08 },
        })
        map.addLayer({
          id: 'evac-alert-line',
          type: 'line',
          source: 'evac-alert',
          paint: { 'line-color': '#EF9F27', 'line-width': 1.5 },
        })

        // Evacuation Order zone (2km buffer) — on top of Alert zone
        map.addSource('evac-order', {
          type: 'geojson',
          data: bboxPolygon(...bbox, 2),
        })
        map.addLayer({
          id: 'evac-order-fill',
          type: 'fill',
          source: 'evac-order',
          paint: { 'fill-color': '#E24B4A', 'fill-opacity': 0.12 },
        })
        map.addLayer({
          id: 'evac-order-line',
          type: 'line',
          source: 'evac-order',
          paint: { 'line-color': '#E24B4A', 'line-width': 1.5 },
        })

        // --- Fire perimeter ---

        map.addSource('fire-perimeter', {
          type: 'geojson',
          data: '/mcdougall_creek_perimeter.geojson',
        })
        map.addLayer({
          id: 'fire-perimeter-fill',
          type: 'fill',
          source: 'fire-perimeter',
          paint: { 'fill-color': '#E24B4A', 'fill-opacity': 0.15 },
        })
        map.addLayer({
          id: 'fire-perimeter-line',
          type: 'line',
          source: 'fire-perimeter',
          paint: { 'line-color': '#A32D2D', 'line-width': 2 },
        })

        // --- Road closures ---

        // Mapbox uses [lng, lat]; JSON has { lat, lng } — swap here.
        const closureFeatures = closuresData.road_closures.map((c) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [c.coordinates_from.lng, c.coordinates_from.lat],
              [c.coordinates_to.lng, c.coordinates_to.lat],
            ],
          },
          properties: {
            road_name: c.road_name,
            status: c.status,
          },
        }))

        map.addSource('road-closures', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: closureFeatures },
        })

        // CLOSED = red 4px, ADVISORY = amber 3px; both dashed
        map.addLayer({
          id: 'road-closures-line',
          type: 'line',
          source: 'road-closures',
          paint: {
            'line-color': [
              'match',
              ['get', 'status'],
              'CLOSED', '#E24B4A',
              '#EF9F27', // ADVISORY (default)
            ],
            'line-width': ['match', ['get', 'status'], 'CLOSED', 4, 3],
            'line-dasharray': [4, 2],
          },
        })

        map.addLayer({
          id: 'road-closures-labels',
          type: 'symbol',
          source: 'road-closures',
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'road_name'],
            'text-size': 11,
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': [
              'match',
              ['get', 'status'],
              'CLOSED', '#E24B4A',
              '#EF9F27',
            ],
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
        })
        // --- Shelter pins ---

        // Status defaulted to 'Open' until dynamic status is wired in Phase 5.
        const shelterFeatures = sheltersData.shelters.map((s) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [s.lng, s.lat],
          },
          properties: { name: s.name, status: 'Open' },
        }))

        map.addSource('shelters', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: shelterFeatures },
        })

        // Circle pins: Open=green, Filling=amber, Near Full=red; white border
        map.addLayer({
          id: 'shelter-pins',
          type: 'circle',
          source: 'shelters',
          paint: {
            'circle-radius': 12,
            'circle-color': [
              'match',
              ['get', 'status'],
              'Open', '#639922',
              'Filling', '#EF9F27',
              '#E24B4A', // Near Full (default)
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })

        map.addLayer({
          id: 'shelter-labels',
          type: 'symbol',
          source: 'shelters',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.8],
            'text-anchor': 'top',
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': '#1a1a1a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
        })
      })()
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="w-full h-[65vh]" />
}
