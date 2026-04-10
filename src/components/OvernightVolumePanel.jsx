import { useState, useEffect } from 'react'

const STORAGE_KEY = 'overnight-vol'
const THRESHOLDS = { chop: 8, directional: 15 }

function getSignal(vol) {
  if (vol === null) return null
  if (vol < THRESHOLDS.chop) return 'CHOP'
  if (vol < THRESHOLDS.directional) return 'MODERATE'
  return 'DIRECTIONAL'
}

export default function OvernightVolumePanel() {
  const [vol, setVol] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return ''
    const { value, date } = JSON.parse(saved)
    // Reset each day
    if (date !== new Date().toDateString()) return ''
    return value
  })

  const [input, setInput] = useState(vol)

  useEffect(() => {
    if (vol !== '') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: vol, date: new Date().toDateString() }))
    }
  }, [vol])

  const volNum = parseFloat(vol) || null
  const signal = getSignal(volNum)

  const signalStyle = {
    CHOP:        { bg: 'bg-gray-800', text: 'text-gray-400', label: 'CHOP DAY — Take 10-30% profits' },
    MODERATE:    { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: 'MODERATE — Use confluence to decide' },
    DIRECTIONAL: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', label: 'DIRECTIONAL DAY — Hold for full move' },
  }

  const s = signal ? signalStyle[signal] : null

  return (
    <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">Overnight Vol</span>
        <a
          href="https://www.cboe.com/us/options/market_statistics/daily/"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400"
        >
          Cboe Stats ↗
        </a>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500 text-sm">$</span>
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => setVol(input)}
          onKeyDown={(e) => e.key === 'Enter' && setVol(input)}
          placeholder="e.g. 12.5"
          className="w-28 bg-[#050508] border border-[#1f2133] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <span className="text-gray-500 text-xs">M SPX overnight</span>
      </div>

      {s && (
        <div className={`rounded px-3 py-2 ${s.bg}`}>
          <div className={`text-sm font-bold ${s.text}`}>{signal}</div>
          <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
        </div>
      )}

      {!signal && (
        <div className="text-xs text-gray-600">
          Enter overnight SPX options volume from Cboe to get today's signal.
        </div>
      )}

      <div className="flex gap-3 mt-3 text-xs text-gray-600">
        <span>&lt;${THRESHOLDS.chop}M → CHOP</span>
        <span>${THRESHOLDS.chop}-${THRESHOLDS.directional}M → MOD</span>
        <span>&gt;${THRESHOLDS.directional}M → DIR</span>
      </div>
    </div>
  )
}
