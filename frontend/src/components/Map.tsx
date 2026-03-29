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
        const res = await fetch('/mcdougall_creek_perimeter.geojson')
        const perimeter = (await res.json()) as {
          features: Array<{ geometry: { coordinates: number[][][] } }>
        }

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

        // Evacuation Alert zone (5km buffer) — added first, renders underneath Order zone
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

        // Fire perimeter — on top of both evacuation zones
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
      })()
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="w-full h-[65vh]" />
}
