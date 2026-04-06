import { useState, useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FeatureCollection } from 'geojson'
import MapLegend from './MapLegend'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''


type Coord = { lat: number; lng: number }
type RoadClosure = {
  id: string
  road_name: string
  status: string
  waypoints?: Coord[]
  coordinates_from: Coord
  coordinates_to: Coord
}

// Closures whose geometry has been snapped to real OSM roads via
// backend/scripts/snap_closures_to_roads.py. These are rendered from
// /road_closures_geometry.geojson instead of hand-traced waypoints.
const SNAPPED_CLOSURE_IDS = new Set<string>([
  'closure_001',
  'closure_002',
  'closure_003',
  'closure_004',
])
type Shelter = { id?: string; name: string; lat: number; lng: number }

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

  // --- Fire perimeter (pulsing) ---

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
  // Closures in SNAPPED_CLOSURE_IDS are rendered from the pre-snapped
  // /road_closures_geometry.geojson file below; skip them here so we don't
  // double-render.
  const closureFeatures = d.closures.road_closures
    .filter((c) => !SNAPPED_CLOSURE_IDS.has(c.id))
    .map((c) => {
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

  // Pre-snapped road closure geometry (Mapbox Map Matching output committed at
  // dev time). Rendered with identical paint/layout to the waypoint-based
  // closures so the layer toggle covers both uniformly.
  map.addSource('road-closures-snapped', {
    type: 'geojson',
    data: '/road_closures_geometry.geojson',
  })
  map.addLayer({
    id: 'road-closures-snapped-line',
    type: 'line',
    source: 'road-closures-snapped',
    paint: {
      'line-color': ['match', ['get', 'status'], 'CLOSED', '#E24B4A', '#EF9F27'],
      'line-width': ['match', ['get', 'status'], 'CLOSED', 4, 3],
      'line-dasharray': [4, 2],
    },
  })
  map.addLayer({
    id: 'road-closures-snapped-labels',
    type: 'symbol',
    source: 'road-closures-snapped',
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

  const shelterFeatures = buildShelterFeatures(d.shelters.shelters)

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
        'Full', '#991B1B',
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

  // Wind indicator is now a DOM Marker (see createWindMarkerElement below)
  // so it survives setStyle() calls and supports CSS animation.

  // --- User location blue dot (always last = always on top) ---
  // Created here with empty data so the layers exist at the top of the stack.
  // updateUserLocation() later fills in the actual coordinates.

  map.addSource('user-location', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'user-location-glow',
    type: 'circle',
    source: 'user-location',
    paint: {
      'circle-radius': 20,
      'circle-color': '#3B82F6',
      'circle-opacity': 0.3,
    },
  })
  map.addLayer({
    id: 'user-location-dot',
    type: 'circle',
    source: 'user-location',
    paint: {
      'circle-radius': 9,
      'circle-color': '#3B82F6',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
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

// Builds GeoJSON features for shelter pins, applying statuses from the given map.
function buildShelterFeatures(shelters: Shelter[], statuses: Record<string, string> = {}) {
  return shelters.map((s) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
    properties: { name: s.name, status: (s.id && statuses[s.id]) ? statuses[s.id] : 'Open' },
  }))
}

// Updates the shelters GeoJSON source with new status values.
function updateShelterStatuses(
  map: mapboxgl.Map,
  shelters: Shelter[],
  statuses: Record<string, string>,
) {
  const source = map.getSource('shelters') as mapboxgl.GeoJSONSource | undefined
  if (!source) return
  source.setData({ type: 'FeatureCollection', features: buildShelterFeatures(shelters, statuses) })
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

// Starts a requestAnimationFrame loop that oscillates the fire perimeter
// fill-opacity between 0.08 and 0.25 on a ~2.5s sine-wave cycle. Returns a
// cancel function to stop the loop (called on unmount or style change).
function startFirePulse(map: mapboxgl.Map): () => void {
  let raf = 0
  function tick() {
    if (!map.getLayer('fire-perimeter-fill')) return
    // 2.5-second full cycle
    const t = (Date.now() % 2500) / 2500
    const opacity = 0.08 + 0.17 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2))
    map.setPaintProperty('fire-perimeter-fill', 'fill-opacity', opacity)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

// Creates the animated wind badge DOM element used for the Mapbox Marker.
// Injects CSS keyframes once into the document head.
// Wind is 42 km/h NE (bearing 45°) from BCWS station 1277 on Aug 17 @ 9:55 PM.
function createWindMarkerElement(): HTMLDivElement {
  if (!document.getElementById('ember-wind-marker-styles')) {
    const style = document.createElement('style')
    style.id = 'ember-wind-marker-styles'
    style.textContent = `
      @keyframes emberWindStream {
        0%   { opacity: 0.15; }
        50%  { opacity: 1;    }
        100% { opacity: 0.15; }
      }
      .ember-wc1 { animation: emberWindStream 1.8s ease-in-out infinite 0s;    }
      .ember-wc2 { animation: emberWindStream 1.8s ease-in-out infinite 0.6s;  }
      .ember-wc3 { animation: emberWindStream 1.8s ease-in-out infinite 1.2s;  }
    `
    document.head.appendChild(style)
  }

  const el = document.createElement('div')
  el.style.cssText = 'pointer-events:none;user-select:none;'
  // Chevrons point right (East). Rotate container −45° to point NE.
  el.innerHTML = `
    <div style="
      background:rgba(17,24,39,0.82);
      backdrop-filter:blur(8px);
      -webkit-backdrop-filter:blur(8px);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:10px;
      padding:7px 12px;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:3px;
      box-shadow:0 4px 16px rgba(0,0,0,0.4);
    ">
      <div style="transform:rotate(-45deg);display:flex;align-items:center;gap:0px;line-height:1;">
        <span class="ember-wc1" style="color:#f97316;font-size:22px;font-weight:bold;">›</span>
        <span class="ember-wc2" style="color:#f97316;font-size:22px;font-weight:bold;">›</span>
        <span class="ember-wc3" style="color:#f97316;font-size:22px;font-weight:bold;">›</span>
      </div>
      <span style="color:#f97316;font-size:11px;font-weight:700;font-family:monospace;letter-spacing:0.02em;white-space:nowrap;">42 km/h NE</span>
      <span style="color:#9ca3af;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Wind</span>
    </div>
  `
  return el
}

const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const

type LayerVisibility = {
  spread: boolean
  evacZones: boolean
  closures: boolean
  shelters: boolean
}

const LAYER_GROUPS: Record<keyof LayerVisibility, string[]> = {
  spread: ['spread-6hr-fill', 'spread-6hr-line', 'spread-4hr-fill', 'spread-4hr-line', 'spread-2hr-fill', 'spread-2hr-line'],
  evacZones: ['evac-alert-fill', 'evac-alert-line', 'evac-order-fill', 'evac-order-line'],
  closures: ['road-closures-line', 'road-closures-labels', 'road-closures-snapped-line', 'road-closures-snapped-labels'],
  shelters: ['shelter-pins', 'shelter-labels'],
}

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
  spread: 'Spread projections',
  evacZones: 'Evac zones',
  closures: 'Road closures',
  shelters: 'Shelters',
}

function applyLayerVisibility(map: mapboxgl.Map, vis: LayerVisibility) {
  for (const group of Object.keys(LAYER_GROUPS) as Array<keyof LayerVisibility>) {
    const visibility = vis[group] ? 'visible' : 'none'
    for (const id of LAYER_GROUPS[group]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visibility)
      }
    }
  }
}

// User location is handled via a mapboxgl.Marker (DOM element, not a GL layer).
// Markers survive setStyle() calls and don't require isStyleLoaded() — no timing issues.

type MapProps = {
  routePolyline?: string | null
  userLocation?: { lat: number; lng: number } | null
  shelterStatuses?: Record<string, string>
}

export default function Map({ routePolyline = null, userLocation = null, shelterStatuses }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapDataRef = useRef<MapData | null>(null)
  const routePolylineRef = useRef<string | null>(null)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const windMarkerRef = useRef<mapboxgl.Marker | null>(null)

  const shelterStatusesRef = useRef<Record<string, string>>({})
  const [satellite, setSatellite] = useState(false)
  const [layerVis, setLayerVis] = useState<LayerVisibility>({
    spread: true,
    evacZones: true,
    closures: true,
    shelters: true,
  })
  const layerVisRef = useRef<LayerVisibility>(layerVis)
  const [showLayersPanel, setShowLayersPanel] = useState(false)

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
    let cancelPulse: (() => void) | null = null

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
        mapDataRef.current = mapData
        addAllLayers(map, mapData)
        cancelPulse = startFirePulse(map)

        // Wind badge — positioned at fire perimeter centroid (~[-119.57, 49.95])
        // DOM Marker survives setStyle() calls, supports CSS animation.
        if (!windMarkerRef.current) {
          windMarkerRef.current = new mapboxgl.Marker({
            element: createWindMarkerElement(),
            anchor: 'center',
          })
            .setLngLat([-119.57, 49.95])
            .addTo(map)
        }

        // Apply any prop data that arrived before the map finished loading
        if (routePolylineRef.current) updateRouteLayer(map, routePolylineRef.current)
        if (Object.keys(shelterStatusesRef.current).length > 0) {
          updateShelterStatuses(map, mapData.shelters.shelters, shelterStatusesRef.current)
        }
      })()
    })

    // Re-add all layers after setStyle() clears them
    map.on('style.load', () => {
      if (!initialLoadComplete || !mapData) return
      cancelPulse?.()
      addAllLayers(map, mapData)
      cancelPulse = startFirePulse(map)
      applyLayerVisibility(map, layerVisRef.current)
      if (routePolylineRef.current) updateRouteLayer(map, routePolylineRef.current)
      if (Object.keys(shelterStatusesRef.current).length > 0) {
        updateShelterStatuses(map, mapData.shelters.shelters, shelterStatusesRef.current)
      }
    })

    return () => {
      cancelPulse?.()
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      windMarkerRef.current?.remove()
      windMarkerRef.current = null
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

  // Update the user location marker whenever the location prop changes.
  // Using a Marker (DOM element) instead of a GL layer — no style/timing dependency.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat])
      } else {
        const el = document.createElement('div')
        el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.3);'
        userMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map)
      }
      map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 13, duration: 1500 })
    } else {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
    }
  }, [userLocation])

  // Update shelter pin colors when admin statuses change
  useEffect(() => {
    shelterStatusesRef.current = shelterStatuses ?? {}
    const map = mapRef.current
    const data = mapDataRef.current
    if (!map || !map.isStyleLoaded() || !data) return
    updateShelterStatuses(map, data.shelters.shelters, shelterStatuses ?? {})
  }, [shelterStatuses])

  // Apply layer visibility changes to the map
  useEffect(() => {
    layerVisRef.current = layerVis
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    applyLayerVisibility(map, layerVis)
  }, [layerVis])

  const handleLayerToggle = useCallback((group: keyof LayerVisibility) => {
    setLayerVis(prev => ({ ...prev, [group]: !prev[group] }))
  }, [])

  const handleStyleToggle = useCallback(() => {
    if (!mapRef.current) return
    const next = !satellite
    setSatellite(next)
    mapRef.current.setStyle(next ? STYLES.satellite : STYLES.streets)
  }, [satellite])

  return (
    <div ref={containerRef} className="relative w-full h-[65vh] lg:h-full">
      <MapLegend />
      <div className="absolute top-2.5 right-10 z-10 flex gap-1.5 items-start">
        {/* Layers toggle panel */}
        <div className="relative">
          <button
            onClick={() => setShowLayersPanel(v => !v)}
            className="bg-white/90 text-gray-800 text-xs font-medium px-3 py-1.5 rounded-full shadow hover:bg-white transition-colors"
          >
            Layers
          </button>
          {showLayersPanel && (
            <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg p-3 min-w-[160px]">
              {(Object.keys(LAYER_GROUPS) as Array<keyof LayerVisibility>).map(group => (
                <label key={group} className="flex items-center gap-2 py-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={layerVis[group]}
                    onChange={() => handleLayerToggle(group)}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-700">{LAYER_LABELS[group]}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Satellite / street toggle */}
        <button
          onClick={handleStyleToggle}
          className="bg-white/90 text-gray-800 text-xs font-medium px-3 py-1.5 rounded-full shadow hover:bg-white transition-colors"
        >
          {satellite ? 'Map' : 'Satellite'}
        </button>
      </div>
    </div>
  )
}
