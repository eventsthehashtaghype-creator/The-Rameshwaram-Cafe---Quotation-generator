'use client'
import { useEffect, useState } from 'react'
import AppSidebar from '@/app/components/AppSidebar'
import { getActivityLogs, LogEntry } from '@/app/lib/audit'
import { supabase } from '@/app/lib/supabase'

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadLogs() {
      setLoading(true)
      const data = await getActivityLogs()
      setLogs(data)
      setLoading(false)
    }
    loadLogs()
  }, [])

  const filteredLogs = logs.filter(log => {
    const q = search.toLowerCase()
    return (
      (log.actorName && log.actorName.toLowerCase().includes(q)) ||
      (log.clientName && log.clientName.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.districtState && log.districtState.toLowerCase().includes(q)) ||
      (log.eventCode && log.eventCode.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans text-black">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight mb-1">Activity Logs</h1>
            <p className="text-gray-500 font-bold text-xs lg:text-sm">Audit trail of actions across all logins (Admin, Staff, Client)</p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Filter logs by actor, action, client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-4 bg-gray-50 border-b border-gray-100 font-black text-xs text-gray-500 uppercase tracking-wider flex justify-between items-center">
            <span>Log Record String</span>
            <span className="text-[10px] text-gray-400 font-bold">Total: {filteredLogs.length}</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 font-bold text-sm">Loading activity logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-bold text-sm">
              No activity logs recorded yet. Action logs will appear here when events, menus, or quotes are updated.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log, idx) => (
                <div key={log.id || idx} className="p-4 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 text-sm leading-relaxed">
                      <span className="text-blue-700 font-black bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{log.actorName || 'System'}</span>
                      {' '}-{' '}
                      <span className="text-slate-800 font-bold">{log.clientName || 'General'}</span>
                      {' '}-{' '}
                      <span className={`font-black px-2 py-0.5 rounded text-[11px] ${
                        log.action.includes('Accept') || log.action.includes('Confirm') ? 'bg-green-100 text-green-700' :
                        log.action.includes('Reject') || log.action.includes('Cancel') ? 'bg-red-100 text-red-700' :
                        log.action.includes('Menu') ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        "{log.action}"
                      </span>
                      {' '}
                      <span className="text-gray-400 font-normal">»</span>
                      {' '}
                      <span className="text-gray-700 font-medium">{log.districtState || 'Karnataka'}</span>
                      {' '}
                      <span className="text-gray-400 font-normal">»</span>
                      {' '}
                      <span className="text-blue-600 font-bold">{log.eventStartDate ? new Date(log.eventStartDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                      {' '}-{' '}
                      <span className="text-black font-black bg-gray-100 px-1.5 py-0.5 rounded">{log.eventCode}</span>
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-gray-500 font-sans italic ml-1">Reason / Notes: {log.details}</p>
                    )}
                  </div>
                  {log.timestamp && (
                    <div className="text-[10px] text-gray-400 font-sans whitespace-nowrap shrink-0">
                      {new Date(log.timestamp).toLocaleString('en-GB')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
