import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

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
      map.addSource('fire-perimeter', {
        type: 'geojson',
        data: '/mcdougall_creek_perimeter.geojson',
      })

      map.addLayer({
        id: 'fire-perimeter-fill',
        type: 'fill',
        source: 'fire-perimeter',
        paint: {
          'fill-color': '#E24B4A',
          'fill-opacity': 0.15,
        },
      })

      map.addLayer({
        id: 'fire-perimeter-line',
        type: 'line',
        source: 'fire-perimeter',
        paint: {
          'line-color': '#A32D2D',
          'line-width': 2,
        },
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="w-full h-[65vh]" />
}
