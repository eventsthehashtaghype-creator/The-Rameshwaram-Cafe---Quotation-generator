export type Client = {
  id: string
  entity_name: string
  contact_person: string
  mobile: string
  email: string
  // --- NEW FIELDS ADDED ---
  gst_number?: string  // The '?' means it's optional
  city?: string
  state?: string
  address?: string
}

export type Event = {
  id: string
  event_code: string
  event_date: string
  end_date?: string // Added end_date
  pax_count: number
  status: 'draft' | 'sent' | 'approved' | 'completed' | 'client_updated'
  client?: Client
  shareable_slug: string
  city?: string
  state?: string
  // --- NEW FIELDS ---
  event_type?: 'B2B' | 'B2C'
  event_size?: 'Small' | 'Large'
  google_maps_link?: string
}

export type MenuItem = {
  id: number
  category_id: number
  item_name: string
  unit_price: number
  is_live_station: boolean
}

export type Category = {
  id: number
  name: string
  items: MenuItem[]
}