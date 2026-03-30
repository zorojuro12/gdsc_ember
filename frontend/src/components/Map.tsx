import { useState, useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FeatureCollection } from 'geojson'
import MapLegend from './MapLegend'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''


type Coord = { lat: number; lng: number }
type RoadClosure = {
  road_name: string
  status: string
  waypoints?: Coord[]
  coordinates_from: Coord
  coordinates_to: Coord
}
type Shelter = { name: string; lat: number; lng: number }

type MapData = {
  spread2hr: FeatureCollection
  spread4hr: FeatureCollection
  spread6hr: FeatureCollection
  evacOrder: FeatureCollection
  evacAlert: FeatureCollection
  perimeter: { features: Array<{ geometry: { coordinates: number[][][] } }> }
  closures: { road_closures: RoadClosure[] }
  shelters: { shelters: Shelter[] }
}

// Adds all sources and layers to the map. Called on initial load and after every
// setStyle() call (which clears all sources/layers).
function addAllLayers(map: mapboxgl.Map, d: MapData) {
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

  // --- Evacuation zones (Shapely-buffered GeoJSON around fire perimeter) ---
  // Alert zone rendered first (bottom) so order zone sits on top.

  map.addSource('evac-alert', { type: 'geojson', data: d.evacAlert })
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

  map.addSource('evac-order', { type: 'geojson', data: d.evacOrder })
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
  // Use waypoints array when present for better road tracing, otherwise fall back
  // to the two-point from/to line.
  const closureFeatures = d.closures.road_closures.map((c) => {
    const coords = c.waypoints && c.waypoints.length >= 2
      ? c.waypoints.map((w) => [w.lng, w.lat])
      : [[c.coordinates_from.lng, c.coordinates_from.lat], [c.coordinates_to.lng, c.coordinates_to.lat]]
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: { road_name: c.road_name, status: c.status },
    }
  })

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

// Decodes a Google Maps encoded polyline string into [lng, lat] pairs for Mapbox.
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}

// Adds or updates the route line source/layer with the given encoded polyline.
function updateRouteLayer(map: mapboxgl.Map, polyline: string | null) {
  const coords = polyline ? decodePolyline(polyline) : []
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: coords.length > 0 ? [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    }] : [],
  }
  const existing = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(data)
  } else {
    map.addSource('route', { type: 'geojson', data })
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#3B82F6', 'line-width': 4, 'line-opacity': 0.9 },
    })
  }
}

const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const

export default function Map({ routePolyline = null }: { routePolyline?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const routePolylineRef = useRef<string | null>(null)
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
        const [s2, s4, s6, eo, ea, perim, clos, shel] = await Promise.all([
          fetch('/spread_2hr.geojson'),
          fetch('/spread_4hr.geojson'),
          fetch('/spread_6hr.geojson'),
          fetch('/evac_order_zone.geojson'),
          fetch('/evac_alert_zone.geojson'),
          fetch('/mcdougall_creek_perimeter.geojson'),
          fetch('/road_closures.json'),
          fetch('/shelters.json'),
        ])
        mapData = {
          spread2hr: (await s2.json()) as FeatureCollection,
          spread4hr: (await s4.json()) as FeatureCollection,
          spread6hr: (await s6.json()) as FeatureCollection,
          evacOrder: (await eo.json()) as FeatureCollection,
          evacAlert: (await ea.json()) as FeatureCollection,
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
      if (routePolylineRef.current) updateRouteLayer(map, routePolylineRef.current)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update the route layer whenever the polyline prop changes
  useEffect(() => {
    routePolylineRef.current = routePolyline
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    updateRouteLayer(map, routePolyline)
  }, [routePolyline])

  const handleStyleToggle = useCallback(() => {
    if (!mapRef.current) return
    const next = !satellite
    setSatellite(next)
    mapRef.current.setStyle(next ? STYLES.satellite : STYLES.streets)
  }, [satellite])

  return (
    <div ref={containerRef} className="relative w-full h-[65vh] lg:h-full">
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
