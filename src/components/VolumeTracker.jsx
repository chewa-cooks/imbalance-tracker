import { useState, useCallback } from 'react'

// Default thresholds (user-adjustable in component state)
const DEFAULT_THRESHOLDS = {
  spx: { chop: 8,    directional: 15,   unit: '$M',       label: 'SPX Options' },
  es:  { chop: 400,  directional: 800,   unit: 'K contr.', label: 'ES Futures'  },
  nq:  { chop: 150,  directional: 300,   unit: 'K contr.', label: 'NQ Futures'  },
}

function getSignal(val, thresh) {
  if (val == null) return null
  if (val < thresh.chop) return 'CHOP'
  if (val < thresh.directional) return 'MODERATE'
  return 'DIRECTIONAL'
}

const SIGNAL_COLOR = {
  DIRECTIONAL: { bar: '#34d399', bg: 'bg-emerald-900/30', text: 'text-emerald-400', label: 'DIRECTIONAL — Hold for full move' },
  MODERATE:    { bar: '#fbbf24', bg: 'bg-yellow-900/30',  text: 'text-yellow-400',  label: 'MODERATE — Use confluence'      },
  CHOP:        { bar: '#4b5563', bg: 'bg-gray-800/50',    text: 'text-gray-400',    label: 'CHOP DAY — Take 10-30% profits' },
}

// SVG bar chart for one instrument
function BarChart({ records, field, thresh, unit }) {
  const data = [...records]
    .reverse()
    .slice(-10)
    .filter((r) => r[field] != null)

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-700 text-xs">
        No data yet — log some sessions below
      </div>
    )
  }

  const max = Math.max(...data.map((r) => r[field]), thresh.directional * 1.3)
  const W = 100 // SVG viewBox width per bar slot
  const H = 120
  const PAD_TOP = 10
  const BAR_W = 60
  const SLOT_W = W
  const totalW = data.length * SLOT_W

  const yOf = (v) => H - PAD_TOP - ((v / max) * (H - PAD_TOP - 10))
  const chopY       = yOf(thresh.chop)
  const dirY        = yOf(thresh.directional)

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${H + 24}`}
        style={{ width: '100%', minWidth: data.length * 48, height: 160 }}
        className="block"
      >
        {/* Threshold lines */}
        <line x1={0} y1={dirY}  x2={totalW} y2={dirY}  stroke="#34d399" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
        <line x1={0} y1={chopY} x2={totalW} y2={chopY} stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />
        <text x={2} y={dirY - 2}  fill="#34d399" fontSize="7" opacity="0.7">DIR {thresh.directional}{unit.includes('$') ? 'M' : 'K'}</text>
        <text x={2} y={chopY - 2} fill="#fbbf24" fontSize="7" opacity="0.6">CHOP {thresh.chop}{unit.includes('$') ? 'M' : 'K'}</text>

        {data.map((r, i) => {
          const val = r[field]
          const signal = getSignal(val, thresh)
          const color = SIGNAL_COLOR[signal]?.bar || '#4b5563'
          const barH = Math.max(((val / max) * (H - PAD_TOP - 10)), 2)
          const x = i * SLOT_W + (SLOT_W - BAR_W) / 2
          const y = H - PAD_TOP - barH

          const dateLabel = new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

          return (
            <g key={r.id}>
              {/* Bar */}
              <rect x={x} y={y} width={BAR_W} height={barH} fill={color} opacity="0.85" rx="2" />
              {/* Value label on bar */}
              <text x={x + BAR_W / 2} y={y - 3} fill={color} fontSize="8" textAnchor="middle" fontWeight="bold">
                {val % 1 === 0 ? val : val.toFixed(1)}
              </text>
              {/* Date label */}
              <text x={x + BAR_W / 2} y={H + 14} fill="#6b7280" fontSize="8" textAnchor="middle">
                {dateLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Today's signal badge
function SignalBadge({ val, thresh, label }) {
  const signal = getSignal(val, thresh)
  if (!signal) return <span className="text-gray-700 text-xs">—</span>
  const s = SIGNAL_COLOR[signal]
  return (
    <div className={`rounded px-3 py-1.5 ${s.bg} flex items-center justify-between gap-4`}>
      <div>
        <span className={`text-xs font-bold ${s.text}`}>{signal}</span>
        <span className="text-gray-500 text-xs ml-2">{s.label}</span>
      </div>
      <span className={`text-sm font-bold ${s.text}`}>
        {val} {thresh.unit}
      </span>
    </div>
  )
}

export default function VolumeTracker({ records, onLog, onDelete, loading }) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({ date: today, spx_vol: '', es_vol: '', nq_vol: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [showThresh, setShowThresh] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchStatus, setFetchStatus] = useState(null) // { ok: bool, message: string }

  const autoFetch = useCallback(async () => {
    setFetching(true)
    setFetchStatus(null)
    try {
      const res = await fetch('/api/overnight-volume')
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()

      const updates = {}
      const warnings = []

      if (data.spx && !data.spx.error) {
        updates.spx_vol = data.spx.millions?.toString() || ''
      } else {
        warnings.push(`SPX: ${data.spx?.error || 'unavailable'}`)
      }

      if (data.es && !data.es.error) {
        updates.es_vol = (data.es.thousands || Math.round((data.es.contracts || 0) / 1000)).toString()
      } else {
        warnings.push(`ES: ${data.es?.error || 'unavailable'}`)
      }

      if (data.nq && !data.nq.error) {
        updates.nq_vol = (data.nq.thousands || Math.round((data.nq.contracts || 0) / 1000)).toString()
      } else {
        warnings.push(`NQ: ${data.nq?.error || 'unavailable'}`)
      }

      setForm((f) => ({ ...f, ...updates }))
      setFetchStatus({
        ok: warnings.length < 3,
        message: warnings.length
          ? `Partial: ${warnings.join(' · ')}`
          : '✓ All fields populated — review and log',
      })
    } catch (e) {
      setFetchStatus({
        ok: false,
        message: `Auto-fetch failed: ${e.message}. Only works on deployed Vercel URL, not localhost.`,
      })
    } finally {
      setFetching(false)
    }
  }, [])

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaveError(null)
    setSaving(true)
    try {
      await onLog(form)
      setForm({ date: today, spx_vol: '', es_vol: '', nq_vol: '', notes: '' })
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Latest record for today's signal
  const latest = records[0]
  const isToday = latest?.date === today

  const inputCls = 'w-full bg-[#050508] border border-[#1f2133] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500'

  const instruments = [
    { key: 'spx', field: 'spx_vol', ...thresholds.spx },
    { key: 'es',  field: 'es_vol',  ...thresholds.es  },
    { key: 'nq',  field: 'nq_vol',  ...thresholds.nq  },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-widest text-gray-500 uppercase">Pre-Market Volume</h1>
        <button
          onClick={() => setShowThresh(!showThresh)}
          className="text-xs text-gray-600 hover:text-gray-400 border border-[#1f2133] px-3 py-1 rounded"
        >
          {showThresh ? 'Hide' : 'Edit'} Thresholds
        </button>
      </div>

      {/* Threshold editor */}
      {showThresh && (
        <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Thresholds</div>
          <div className="grid grid-cols-3 gap-6">
            {instruments.map(({ key, label, unit }) => (
              <div key={key}>
                <div className="text-xs text-gray-400 mb-2 font-bold">{label} <span className="text-gray-600 font-normal">({unit})</span></div>
                <div className="space-y-2">
                  {['chop', 'directional'].map((lvl) => (
                    <label key={lvl} className="flex items-center gap-2">
                      <span className={`text-xs w-20 ${lvl === 'chop' ? 'text-yellow-600' : 'text-emerald-600'}`}>
                        {lvl === 'chop' ? 'Chop below' : 'Dir. above'}
                      </span>
                      <input
                        type="number"
                        value={thresholds[key][lvl]}
                        onChange={(e) => setThresholds((p) => ({
                          ...p,
                          [key]: { ...p[key], [lvl]: parseFloat(e.target.value) || 0 }
                        }))}
                        className="w-20 bg-[#050508] border border-[#1f2133] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's signals (if logged) */}
      {isToday && latest && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 uppercase tracking-wider">Today's Signal</div>
          <div className="grid grid-cols-1 gap-2">
            {instruments.map(({ key, field, label, ...thresh }) => (
              latest[field] != null && (
                <SignalBadge key={key} val={latest[field]} thresh={{ ...thresh }} label={label} />
              )
            ))}
          </div>
          {latest.notes && (
            <div className="text-xs text-gray-600 px-1">📝 {latest.notes}</div>
          )}
        </div>
      )}

      {/* Bar charts */}
      <div className="grid grid-cols-1 gap-4">
        {instruments.map(({ key, field, label, unit, ...thresh }) => (
          <div key={key} className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
              <span className="text-xs text-gray-600">{unit} · last 10 sessions</span>
            </div>
            <BarChart records={records} field={field} thresh={{ chop: thresh.chop, directional: thresh.directional, unit }} unit={unit} />
          </div>
        ))}
      </div>

      {/* Log form */}
      <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Log Session</div>
          <button
            onClick={autoFetch}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-xs font-bold rounded transition-colors disabled:opacity-50"
          >
            {fetching ? (
              <><span className="animate-spin">⟳</span> Fetching…</>
            ) : (
              <><span>⬇</span> Auto-Fetch</>
            )}
          </button>
        </div>
        {fetchStatus && (
          <div className={`text-xs mb-3 px-3 py-2 rounded border ${
            fetchStatus.ok
              ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30'
              : 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30'
          }`}>
            {fetchStatus.message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={set('date')} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">SPX Vol ($M)</label>
              <input type="number" step="0.1" placeholder="e.g. 12.5" value={form.spx_vol} onChange={set('spx_vol')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">ES Vol (K contr.)</label>
              <input type="number" step="1" placeholder="e.g. 650" value={form.es_vol} onChange={set('es_vol')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">NQ Vol (K contr.)</label>
              <input type="number" step="1" placeholder="e.g. 220" value={form.nq_vol} onChange={set('nq_vol')} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Notes (optional) — e.g. heavy call buying 5500 strike"
              value={form.notes}
              onChange={set('notes')}
              className={inputCls + ' flex-1'}
            />
            <button
              type="submit"
              disabled={saving}
              className="px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving…' : 'Log'}
            </button>
          </div>
          {saveError && <div className="text-red-400 text-xs">{saveError}</div>}
        </form>
      </div>

      {/* History table */}
      {records.length > 0 && (
        <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1f2133] text-gray-600 uppercase tracking-wider">
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-right px-3 py-2">SPX $M</th>
                <th className="text-right px-3 py-2">ES K</th>
                <th className="text-right px-3 py-2">NQ K</th>
                <th className="text-left px-3 py-2">SPX Signal</th>
                <th className="text-left px-3 py-2">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const spxSig = getSignal(r.spx_vol, thresholds.spx)
                const sigStyle = spxSig ? SIGNAL_COLOR[spxSig] : null
                return (
                  <tr key={r.id} className="border-b border-[#1f2133] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-gray-300 font-bold">
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 text-right text-white">{r.spx_vol ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{r.es_vol ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{r.nq_vol ?? '—'}</td>
                    <td className="px-3 py-2">
                      {sigStyle && (
                        <span className={`text-xs font-bold ${sigStyle.text}`}>{spxSig}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => onDelete(r.id)} className="text-gray-700 hover:text-red-400 text-xs">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-700 space-y-1">
        <div>Data sources: <a href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-400">Cboe (SPX) ↗</a> · <a href="https://www.cmegroup.com/markets/equities/s-p/e-mini-s-p500.volume.html" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-400">CME ES ↗</a> · <a href="https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.volume.html" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-400">CME NQ ↗</a></div>
        <div>Logging the same date overwrites the previous entry. Thresholds reset on page refresh — calibrate over 2-4 weeks.</div>
      </div>
    </div>
  )
}
