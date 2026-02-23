'use client'
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for Leaflet icons missing in Next.js
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function DraggableMarker({ pos, onDragEnd }: { pos: [number, number], onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<any>(null)
  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker != null) {
        const { lat, lng } = marker.getLatLng()
        onDragEnd(lat, lng)
      }
    },
  }
  return <Marker draggable={true} eventHandlers={eventHandlers} position={pos} ref={markerRef} icon={icon} />
}

export default function EventMap({ 
  onLocationSelect 
}: { 
  onLocationSelect: (data: { lat: number, lng: number, address: any, display_name: string }) => void 
}) {
  const [position, setPosition] = useState<[number, number]>([12.9716, 77.5946])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if(!searchQuery) return
    setIsSearching(true)
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`)
        const data = await res.json()
        setSearchResults(data)
    } catch(e) { console.error(e) }
    setIsSearching(false)
  }

  const selectSearchResult = (item: any) => {
      const newPos: [number, number] = [parseFloat(item.lat), parseFloat(item.lon)]
      setPosition(newPos)
      setSearchResults([]) 
      lookupAddress(newPos[0], newPos[1])
  }

  const lookupAddress = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const data = await res.json()
      onLocationSelect({
        lat, lng,
        address: data.address,
        display_name: data.display_name
      })
    } catch (e) { console.error(e) }
  }

  const handleDragEnd = (lat: number, lng: number) => {
    setPosition([lat, lng])
    lookupAddress(lat, lng)
  }

  function Recenter({ lat, lng }: { lat: number, lng: number }) {
    const map = useMapEvents({})
    useEffect(() => { map.setView([lat, lng]) }, [lat, lng])
    return null
  }

  return (
    <div className="relative group rounded border border-gray-400 shadow-sm bg-white overflow-hidden">
      
      {/* Search Bar Container */}
      <div className="p-2 bg-gray-100 border-b border-gray-300 flex gap-2">
        <div className="relative flex-1">
            <input 
              // FORCE STYLES TO OVERRIDE GLOBAL DARK THEME
              style={{ color: '#000000', backgroundColor: '#ffffff', border: '1px solid #9ca3af' }}
              className="w-full p-2 text-sm font-bold rounded outline-none placeholder-gray-500"
              placeholder="Search Venue (e.g. Palace Grounds)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            
            {/* Dropdown Results */}
            {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-900 shadow-xl max-h-48 overflow-y-auto mt-1 z-[9999]">
                    {searchResults.map((item, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => selectSearchResult(item)} 
                          style={{ color: '#000000' }}
                          className="w-full text-left p-2 border-b border-gray-200 hover:bg-blue-50 text-xs font-bold truncate"
                        >
                            {item.display_name}
                        </button>
                    ))}
                </div>
            )}
        </div>
        <button 
          onClick={handleSearch} 
          className="bg-black text-white px-4 rounded font-bold text-xs hover:bg-gray-800"
        >
          {isSearching ? '...' : 'SEARCH'}
        </button>
      </div>

      <div className="h-64 w-full bg-gray-200 z-0 relative">
        <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
          <DraggableMarker pos={position} onDragEnd={handleDragEnd} />
          <Recenter lat={position[0]} lng={position[1]} />
        </MapContainer>
      </div>
      
      <div className="bg-yellow-50 border-t border-yellow-200 p-1 text-center">
        <span className="text-[10px] font-bold text-yellow-800">
            📍 Tip: Drag the pin to adjust exact location
        </span>
      </div>
    </div>
  )
}