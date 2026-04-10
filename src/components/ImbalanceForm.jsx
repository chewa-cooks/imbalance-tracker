import { useState, useEffect } from 'react'
import { calcMidpoint } from '../lib/signalEngine'

const DEFAULTS = {
  ticker: 'SPX',
  timeframe: '15m',
  candle_high: '',
  candle_low: '',
  direction: 'BULLISH',
  date_formed: new Date().toISOString().slice(0, 16),
  notes: '',
}

export default function ImbalanceForm({ editImbalance, onSave, onCancel }) {
  const [form, setForm] = useState(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (editImbalance) {
      setForm({
        ticker: editImbalance.ticker,
        timeframe: editImbalance.timeframe,
        candle_high: editImbalance.candle_high.toString(),
        candle_low: editImbalance.candle_low.toString(),
        direction: editImbalance.direction,
        date_formed: editImbalance.date_formed?.slice(0, 16) || DEFAULTS.date_formed,
        notes: editImbalance.notes || '',
      })
    } else {
      setForm(DEFAULTS)
    }
  }, [editImbalance])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const high = parseFloat(form.candle_high)
  const low = parseFloat(form.candle_low)
  const mid = !isNaN(high) && !isNaN(low) && high > low ? calcMidpoint(high, low) : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (isNaN(high) || isNaN(low)) return setError('Enter valid numbers for high and low')
    if (high <= low) return setError('Candle high must be greater than candle low')

    setSaving(true)
    try {
      await onSave(form, editImbalance?.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const labelCls = 'block text-xs text-gray-500 uppercase tracking-wider mb-1'
  const inputCls = 'w-full bg-[#050508] border border-[#1f2133] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors'
  const selectCls = inputCls

  return (
    <div className="max-w-lg">
      <h2 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-6">
        {editImbalance ? 'Edit Imbalance Level' : 'Add Imbalance Level'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Ticker</label>
            <select value={form.ticker} onChange={set('ticker')} className={selectCls}>
              <option>SPX</option>
              <option>SPY</option>
              <option>QQQ</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Timeframe</label>
            <select value={form.timeframe} onChange={set('timeframe')} className={selectCls}>
              <option value="15m">15 min</option>
              <option value="4H">4 Hour</option>
              <option value="1D">Daily</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Candle High</label>
            <input
              type="number"
              step="0.01"
              value={form.candle_high}
              onChange={set('candle_high')}
              placeholder="e.g. 5520.00"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Candle Low</label>
            <input
              type="number"
              step="0.01"
              value={form.candle_low}
              onChange={set('candle_low')}
              placeholder="e.g. 5490.00"
              className={inputCls}
              required
            />
          </div>
        </div>

        {/* Live midpoint preview */}
        {mid !== null && (
          <div className="rounded bg-emerald-900/20 border border-emerald-800/30 px-3 py-2 text-sm">
            <span className="text-gray-500">50% Midpoint: </span>
            <span className="text-emerald-400 font-bold">{mid.toFixed(2)}</span>
            <span className="text-gray-600 ml-3 text-xs">Zone size: {(high - low).toFixed(2)} pts</span>
          </div>
        )}

        <div>
          <label className={labelCls}>Direction</label>
          <div className="flex gap-2">
            {['BULLISH', 'BEARISH'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm((f) => ({ ...f, direction: d }))}
                className={`flex-1 py-2 rounded text-sm font-bold transition-colors border ${
                  form.direction === d
                    ? d === 'BULLISH'
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-900/40 text-red-400 border-red-500/40'
                    : 'text-gray-500 border-[#1f2133] hover:border-gray-600'
                }`}
              >
                {d === 'BULLISH' ? '▲ BULLISH (Demand)' : '▼ BEARISH (Supply)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Date Formed</label>
          <input
            type="datetime-local"
            value={form.date_formed}
            onChange={set('date_formed')}
            className={inputCls}
            required
          />
        </div>

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="e.g. Aligns with Heatseeker king node at 5500 — 3-star confluence"
            rows={3}
            className={inputCls + ' resize-none'}
          />
        </div>

        {error && (
          <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded text-sm transition-colors"
          >
            {saving ? 'Saving…' : editImbalance ? 'Update Level' : 'Add Level'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 border border-[#1f2133] hover:border-gray-600 text-gray-400 hover:text-white rounded text-sm transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
