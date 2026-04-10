import { useEffect, useRef, useState, useMemo } from 'react'
import { calcMidpoint } from '../lib/signalEngine'

const TICKERS = ['SPX', 'SPY', 'QQQ']
const TIMEFRAMES = [
  { label: '15m', tv: '15' },
  { label: '1H',  tv: '60' },
  { label: '4H',  tv: '240' },
  { label: '1D',  tv: 'D' },
  { label: '1W',  tv: 'W' },
]

// TradingView symbol mapping
const TV_SYMBOL = { SPX: 'SP:SPX', SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ' }

let widgetCounter = 0

export default function ChartView({ imbalances, prices }) {
  const containerRef = useRef(null)
  const widgetRef = useRef(null)

  const [ticker, setTicker] = useState('SPY')
  const [timeframe, setTimeframe] = useState('15')

  // Load TradingView widget script once
  useEffect(() => {
    if (document.getElementById('tv-script')) return
    const script = document.createElement('script')
    script.id = 'tv-script'
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    document.head.appendChild(script)
  }, [])

  // (Re-)init widget when ticker or timeframe changes
  useEffect(() => {
    const containerId = `tv-chart-${++widgetCounter}`
    if (!containerRef.current) return

    // Clear previous widget
    containerRef.current.innerHTML = `<div id="${containerId}" style="height:100%"></div>`

    const init = () => {
      if (!window.TradingView) return
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: TV_SYMBOL[ticker] || ticker,
        interval: timeframe,
        timezone: 'America/New_York',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a0b10',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        container_id: containerId,
        studies: [],
        overrides: {
          'paneProperties.background': '#0a0b10',
          'paneProperties.backgroundType': 'solid',
          'scalesProperties.textColor': '#6b7280',
        },
      })
    }

    if (window.TradingView) {
      init()
    } else {
      // Wait for script to load
      const script = document.getElementById('tv-script')
      const onLoad = () => init()
      script?.addEventListener('load', onLoad)
      return () => script?.removeEventListener('load', onLoad)
    }
  }, [ticker, timeframe])

  // Imbalances relevant to selected ticker — all timeframes
  const relevantLevels = useMemo(() => {
    return imbalances
      .filter((im) => im.ticker === ticker && im.status === 'ACTIVE')
      .map((im) => ({ ...im, midpoint: calcMidpoint(im.candle_high, im.candle_low) }))
      .sort((a, b) => b.midpoint - a.midpoint)
  }, [imbalances, ticker])

  const currentPrice = prices?.[ticker]?.price || prices?.SPY?.price

  const tfLabel = TIMEFRAMES.find((t) => t.tv === timeframe)?.label || timeframe

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          {TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => setTicker(t)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                ticker === t
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-300 bg-[#0e0f15] border border-[#1f2133]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.tv}
              onClick={() => setTimeframe(tf.tv)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                timeframe === tf.tv
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-300 bg-[#0e0f15] border border-[#1f2133]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600 ml-auto">
          Powered by TradingView · Draw your imbalance zones using the horizontal line tool
        </span>
      </div>

      {/* Chart + reference panel */}
      <div className="flex gap-4" style={{ height: 520 }}>
        {/* TradingView chart */}
        <div
          ref={containerRef}
          className="flex-1 rounded-lg border border-[#1f2133] overflow-hidden"
          style={{ minWidth: 0 }}
        />

        {/* Imbalance reference panel */}
        <div className="w-64 flex-shrink-0 rounded-lg border border-[#1f2133] bg-[#0e0f15] flex flex-col">
          <div className="px-3 py-2 border-b border-[#1f2133]">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{ticker} Key Levels</div>
            <div className="text-xs text-gray-700 mt-0.5">All active timeframes</div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {relevantLevels.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-700 text-center">
                No active {ticker} levels.<br />Add them in + Add Level.
              </div>
            )}

            {relevantLevels.map((im) => {
              const above = currentPrice ? currentPrice < im.midpoint : null
              const approaching = currentPrice
                ? Math.abs(currentPrice - im.midpoint) / currentPrice < 0.003
                : false

              return (
                <div
                  key={im.id}
                  className={`px-3 py-2 border-b border-[#1f2133] ${approaching ? 'bg-orange-900/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-500">{im.timeframe}</span>
                    <span className={`text-xs font-bold ${im.direction === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {im.direction === 'BULLISH' ? '▲' : '▼'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{im.midpoint.toFixed(2)}</span>
                    {approaching && <span className="text-orange-400 text-xs animate-pulse">● NEAR</span>}
                    {above !== null && !approaching && (
                      <span className="text-xs text-gray-600">{above ? 'price below' : 'price above'}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-700 mt-0.5">
                    {im.candle_low.toFixed(2)} – {im.candle_high.toFixed(2)}
                  </div>
                  {im.notes && (
                    <div className="text-xs text-gray-600 mt-1 truncate" title={im.notes}>{im.notes}</div>
                  )}
                </div>
              )
            })}
          </div>

          {currentPrice && (
            <div className="px-3 py-2 border-t border-[#1f2133] bg-[#050508]">
              <div className="text-xs text-gray-600">Current {ticker}</div>
              <div className="text-sm font-bold text-white">{currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-700">
        Tip: Use TradingView's horizontal line tool (hotkey: <span className="text-gray-500">H</span>) to draw your imbalance midpoints directly on the chart.
      </div>
    </div>
  )
}
