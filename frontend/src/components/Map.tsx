import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FeatureCollection } from 'geojson'
import MapLegend from './MapLegend'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

// Degrees per km at West Kelowna latitude (49.86°) — used for evac zone placeholders
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

type MapData = {
  spread2hr: FeatureCollection
  spread4hr: FeatureCollection
  spread6hr: FeatureCollection
  perimeter: { features: Array<{ geometry: { coordinates: number[][][] } }> }
  closures: { road_closures: RoadClosure[] }
  shelters: { shelters: Shelter[] }
}

// Adds all sources and layers to the map. Called on initial load and after every
// setStyle() call (which clears all sources/layers).
function addAllLayers(map: mapboxgl.Map, d: MapData) {
  const allCoords = d.perimeter.features.flatMap((f) =>
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

  // --- Fire spread projections (Shapely-computed GeoJSON) ---
  // Layer order: 6hr (bottom) → 4hr → 2hr → everything else on top.

  const spreadLayers: Array<{
    id: string
    data: FeatureCollection
    opacity: number
  }> = [
    { id: 'spread-6hr', data: d.spread6hr, opacity: 0.06 },
    { id: 'spread-4hr', data: d.spread4hr, opacity: 0.10 },
    { id: 'spread-2hr', data: d.spread2hr, opacity: 0.15 },
  ]

  for (const ring of spreadLayers) {
    map.addSource(ring.id, { type: 'geojson', data: ring.data })
    map.addLayer({
      id: `${ring.id}-fill`,
      type: 'fill',
      source: ring.id,
      paint: { 'fill-color': '#D85A30', 'fill-opacity': ring.opacity },
    })
    map.addLayer({
      id: `${ring.id}-line`,
      type: 'line',
      source: ring.id,
      paint: {
        'line-color': '#D85A30',
        'line-width': 1,
        'line-dasharray': [3, 2],
      },
    })
  }

  // --- Evacuation zone placeholders (bbox polygons) ---

  map.addSource('evac-alert', { type: 'geojson', data: bboxPolygon(...bbox, 5) })
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

  map.addSource('evac-order', { type: 'geojson', data: bboxPolygon(...bbox, 2) })
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
  const closureFeatures = d.closures.road_closures.map((c) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [c.coordinates_from.lng, c.coordinates_from.lat],
        [c.coordinates_to.lng, c.coordinates_to.lat],
      ],
    },
    properties: { road_name: c.road_name, status: c.status },
  }))

  map.addSource('road-closures', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: closureFeatures },
  })
  map.addLayer({
    id: 'road-closures-line',
    type: 'line',
    source: 'road-closures',
    paint: {
      'line-color': ['match', ['get', 'status'], 'CLOSED', '#E24B4A', '#EF9F27'],
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
      'text-color': ['match', ['get', 'status'], 'CLOSED', '#E24B4A', '#EF9F27'],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  })

  // --- Shelter pins ---

  // Status defaulted to 'Open' until dynamic status is wired in Phase 5.
  const shelterFeatures = d.shelters.shelters.map((s) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
    properties: { name: s.name, status: 'Open' },
  }))

  map.addSource('shelters', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: shelterFeatures },
  })
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

  // --- Wind vector arrow ---
  // Hardcoded Aug 17 9PM: FROM 225° (SW) → blowing TO 45° (NE). text-rotate is
  // degrees clockwise from north, so 45 points NE.

  map.addSource('wind-station', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-119.58, 49.86] },
          properties: { bearing: 45 },
        },
      ],
    },
  })
  map.addLayer({
    id: 'wind-arrow',
    type: 'symbol',
    source: 'wind-station',
    layout: {
      'text-field': '▲',
      'text-size': 20,
      'text-rotate': ['get', 'bearing'],
      'text-rotation-alignment': 'map',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#1a1a1a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  })
  map.addLayer({
    id: 'wind-label',
    type: 'symbol',
    source: 'wind-station',
    layout: {
      'text-field': '42 km/h NE',
      'text-size': 11,
      'text-offset': [0, 2],
      'text-anchor': 'top',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#1a1a1a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  })
}

const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [satellite, setSatellite] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES.streets,
      center: [-119.58, 49.86],
      zoom: 11,
    })

    mapRef.current = map

    let mapData: MapData | null = null
    let initialLoadComplete = false

    map.on('load', () => {
      void (async () => {
        initialLoadComplete = true
        const [s2, s4, s6, perim, clos, shel] = await Promise.all([
          fetch('/spread_2hr.geojson'),
          fetch('/spread_4hr.geojson'),
          fetch('/spread_6hr.geojson'),
          fetch('/mcdougall_creek_perimeter.geojson'),
          fetch('/road_closures.json'),
          fetch('/shelters.json'),
        ])
        mapData = {
          spread2hr: (await s2.json()) as FeatureCollection,
          spread4hr: (await s4.json()) as FeatureCollection,
          spread6hr: (await s6.json()) as FeatureCollection,
          perimeter: (await perim.json()) as MapData['perimeter'],
          closures: (await clos.json()) as MapData['closures'],
          shelters: (await shel.json()) as MapData['shelters'],
        }
        addAllLayers(map, mapData)
      })()
    })

    // Re-add all layers after setStyle() clears them
    map.on('style.load', () => {
      if (!initialLoadComplete || !mapData) return
      addAllLayers(map, mapData)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  function handleStyleToggle() {
    if (!mapRef.current) return
    const next = !satellite
    setSatellite(next)
    mapRef.current.setStyle(next ? STYLES.satellite : STYLES.streets)
  }

  return (
    <div ref={containerRef} className="relative w-full h-[65vh]">
      <MapLegend />
      <button
        onClick={handleStyleToggle}
        className="absolute top-2.5 right-10 z-10 bg-white/90 text-gray-800 text-xs font-medium px-3 py-1.5 rounded-full shadow hover:bg-white transition-colors"
      >
        {satellite ? 'Map' : 'Satellite'}
      </button>
    </div>
  )
}
