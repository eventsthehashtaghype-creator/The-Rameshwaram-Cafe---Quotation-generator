'use client'
import { useEffect, useState, useMemo } from 'react'
import AppSidebar from '@/app/components/AppSidebar'
import { getActivityLogs, LogEntry } from '@/app/lib/audit'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'quotes' | 'menus' | 'status'>('all')

  useEffect(() => {
    async function loadLogs() {
      setLoading(true)
      const data = await getActivityLogs(300)
      setLogs(data)

      const { data: evts } = await supabase.from('events').select('id, event_code')
      if (evts) setEvents(evts)

      setLoading(false)
    }
    loadLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Category filter
      if (categoryFilter === 'quotes') {
        const isQuote = log.action.toLowerCase().includes('quote') || log.action.toLowerCase().includes('version') || log.action.toLowerCase().includes('revert')
        if (!isQuote) return false
      } else if (categoryFilter === 'menus') {
        const isMenu = log.action.toLowerCase().includes('menu')
        if (!isMenu) return false
      } else if (categoryFilter === 'status') {
        const isStatus = log.action.toLowerCase().includes('accept') || log.action.toLowerCase().includes('reject') || log.action.toLowerCase().includes('cancel') || log.action.toLowerCase().includes('confirm') || log.action.toLowerCase().includes('status')
        if (!isStatus) return false
      }

      // 2. Search text
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        (log.actorName && log.actorName.toLowerCase().includes(q)) ||
        (log.clientName && log.clientName.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.districtState && log.districtState.toLowerCase().includes(q)) ||
        (log.eventCode && log.eventCode.toLowerCase().includes(q)) ||
        (log.details && log.details.toLowerCase().includes(q))
      )
    })
  }, [logs, categoryFilter, search])

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans text-black">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight mb-1">Activity & Change Logs</h1>
            <p className="text-gray-500 font-bold text-xs lg:text-sm">Comprehensive audit trail of all revisions, author identities, and actions</p>
          </div>
          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by actor, reason, event, client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Activity' },
            { id: 'quotes', label: 'Quotation Versions' },
            { id: 'menus', label: 'Menu Changes' },
            { id: 'status', label: 'Status Updates' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                categoryFilter === tab.id
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-4 bg-gray-50 border-b border-gray-100 font-black text-xs text-gray-500 uppercase tracking-wider flex justify-between items-center">
            <span>Log Record String</span>
            <span className="text-[10px] text-gray-400 font-bold">Showing: {filteredLogs.length} Records</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 font-bold text-sm">Loading activity logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-bold text-sm">
              No activity logs found {search ? `matching "${search}"` : ''}.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log, idx) => {
                const targetEvent = events.find(e => e.event_code === log.eventCode)
                const isQuoteAction = log.action.toLowerCase().includes('quote') || log.action.toLowerCase().includes('version') || log.action.toLowerCase().includes('revert')
                const isPositive = log.action.includes('Accept') || log.action.includes('Confirm')
                const isNegative = log.action.includes('Reject') || log.action.includes('Cancel')
                const isMenu = log.action.includes('Menu')

                return (
                  <div key={log.id || idx} className="p-4 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                    <div className="space-y-1.5 flex-1">
                      <div className="font-bold text-slate-900 text-sm leading-relaxed flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const raw = log.actorName || 'System'
                          const match = raw.match(/^([^(]+)(?:\s*\(([^)]+)\))?$/)
                          const name = match ? match[1].trim() : raw
                          const email = match && match[2] ? match[2].trim() : ''

                          return (
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                              <span className="text-blue-900 font-black">👤 {name}</span>
                              {email && (
                                <span className="text-blue-600 font-semibold text-xs font-mono">({email})</span>
                              )}
                            </span>
                          )
                        })()}
                        <span className="text-gray-400">-</span>
                        <span className="text-slate-800 font-bold">{log.clientName || 'General'}</span>
                        <span className="text-gray-400">-</span>
                        <span className={`font-black px-2 py-0.5 rounded text-[11px] border ${
                          isPositive ? 'bg-green-50 text-green-700 border-green-200' :
                          isNegative ? 'bg-red-50 text-red-700 border-red-200' :
                          isQuoteAction ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          isMenu ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          "{log.action}"
                        </span>
                        <span className="text-gray-400 font-normal">»</span>
                        <span className="text-gray-700 font-medium">{log.districtState || 'Karnataka'}</span>
                        <span className="text-gray-400 font-normal">»</span>
                        <span className="text-blue-600 font-bold">{log.eventStartDate ? new Date(log.eventStartDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                        <span className="text-gray-400">-</span>
                        {targetEvent ? (
                          <Link
                            href={`/quotation/${targetEvent.id}`}
                            className="text-black font-black bg-gray-100 hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded transition"
                            title="Open quotation"
                          >
                            {log.eventCode} ↗
                          </Link>
                        ) : (
                          <span className="text-black font-black bg-gray-100 px-1.5 py-0.5 rounded">{log.eventCode}</span>
                        )}
                      </div>

                      {log.details && (
                        <div className="bg-amber-50/60 border border-amber-200/60 rounded px-2.5 py-1 text-[11px] text-gray-700 font-sans inline-block">
                          <span className="font-black text-amber-800 uppercase text-[10px] mr-1.5">Reason / Details:</span>
                          <span>{log.details}</span>
                        </div>
                      )}
                    </div>
                    {log.timestamp && (
                      <div className="text-[11px] text-gray-400 font-sans whitespace-nowrap shrink-0 text-right">
                        {new Date(log.timestamp).toLocaleString('en-GB')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
