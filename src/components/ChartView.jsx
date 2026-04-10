import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineStyle } from 'lightweight-charts'
import { fetchOHLC } from '../lib/polygon'
import { calcMidpoint } from '../lib/signalEngine'

const TICKERS = ['SPX', 'SPY', 'QQQ']
const TIMEFRAMES = ['15m', '4H', '1D']

export default function ChartView({ imbalances }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const priceLines = useRef([])

  const [ticker, setTicker] = useState('SPY')
  const [timeframe, setTimeframe] = useState('15m')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 480,
      layout: {
        background: { color: '#0a0b10' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#1f2133' },
        horzLines: { color: '#1f2133' },
      },
      rightPriceScale: { borderColor: '#1f2133' },
      timeScale: {
        borderColor: '#1f2133',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#f87171',
      borderVisible: false,
      wickUpColor: '#34d399',
      wickDownColor: '#f87171',
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleResize = () => {
      chart.applyOptions({ width: containerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Fetch OHLC when ticker/tf changes
  useEffect(() => {
    if (!seriesRef.current) return
    setLoading(true)
    setError(null)

    fetchOHLC(ticker, timeframe)
      .then((bars) => {
        if (!seriesRef.current) return
        if (!bars.length) {
          setError('No data returned — market may be closed or free tier limit reached')
        } else {
          seriesRef.current.setData(bars)
          chartRef.current?.timeScale().fitContent()
        }
      })
      .catch(() => setError('Failed to fetch chart data'))
      .finally(() => setLoading(false))
  }, [ticker, timeframe])

  // Draw imbalance lines
  useEffect(() => {
    if (!seriesRef.current) return

    // Remove old lines
    priceLines.current.forEach((pl) => {
      try { seriesRef.current?.removePriceLine(pl) } catch {}
    })
    priceLines.current = []

    const relevant = imbalances.filter(
      (im) => im.ticker === ticker && im.timeframe === timeframe && im.status === 'ACTIVE'
    )

    for (const im of relevant) {
      const mid = calcMidpoint(im.candle_high, im.candle_low)
      const color = im.direction === 'BULLISH' ? '#34d399' : '#f87171'
      const dimColor = im.direction === 'BULLISH' ? '#1d4e3a' : '#4e1d1d'

      // Midpoint (primary — solid)
      priceLines.current.push(seriesRef.current.createPriceLine({
        price: mid,
        color,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${im.ticker} ${im.timeframe} 50%`,
      }))

      // Zone edges (dimmed)
      priceLines.current.push(seriesRef.current.createPriceLine({
        price: im.candle_high,
        color: dimColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: '',
      }))
      priceLines.current.push(seriesRef.current.createPriceLine({
        price: im.candle_low,
        color: dimColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: '',
      }))
    }
  }, [imbalances, ticker, timeframe])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4">
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
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                timeframe === tf
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-300 bg-[#0e0f15] border border-[#1f2133]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-gray-500 animate-pulse">Loading…</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="rounded-lg border border-[#1f2133] overflow-hidden"
        style={{ height: 480 }}
      />

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-600">
        <span><span className="text-emerald-400">— —</span> Bullish imbalance 50% line</span>
        <span><span className="text-red-400">— —</span> Bearish imbalance 50% line</span>
        <span className="text-gray-700">Dotted lines = zone edges (high/low)</span>
        {ticker === 'SPX' && (
          <span className="text-yellow-600">Note: SPX chart uses SPY as proxy</span>
        )}
      </div>
    </div>
  )
}
