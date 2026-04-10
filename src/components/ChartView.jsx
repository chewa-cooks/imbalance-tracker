import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineStyle } from 'lightweight-charts'
import { fetchOHLC, TF_LABEL } from '../lib/yahoo'
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

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 520,
      layout: {
        background: { color: '#0a0b10' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#1a1b26' },
        horzLines: { color: '#1a1b26' },
      },
      rightPriceScale: { borderColor: '#1f2133' },
      timeScale: {
        borderColor: '#1f2133',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#374151', labelBackgroundColor: '#1f2133' },
        horzLine: { color: '#374151', labelBackgroundColor: '#1f2133' },
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
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Fetch OHLC from Yahoo Finance when ticker/tf changes
  useEffect(() => {
    if (!seriesRef.current) return
    setLoading(true)
    setError(null)

    fetchOHLC(ticker, timeframe)
      .then((bars) => {
        if (!seriesRef.current) return
        seriesRef.current.setData(bars)
        chartRef.current?.timeScale().fitContent()
      })
      .catch((e) => {
        setError(`Failed to load chart data: ${e.message}`)
      })
      .finally(() => setLoading(false))
  }, [ticker, timeframe])

  // Draw imbalance zones whenever imbalances or ticker/tf changes
  useEffect(() => {
    if (!seriesRef.current) return

    // Clear previous lines
    priceLines.current.forEach((pl) => {
      try { seriesRef.current?.removePriceLine(pl) } catch {}
    })
    priceLines.current = []

    // Draw ALL active imbalances for this ticker across all timeframes
    const relevant = imbalances.filter(
      (im) => im.ticker === ticker && im.status === 'ACTIVE'
    )

    for (const im of relevant) {
      const mid = calcMidpoint(im.candle_high, im.candle_low)
      const isBull = im.direction === 'BULLISH'
      const midColor   = isBull ? '#34d399' : '#f87171'
      const edgeColor  = isBull ? '#1d4e3a' : '#4e1d1d'
      const tfTag = im.timeframe

      // Zone top edge
      priceLines.current.push(seriesRef.current.createPriceLine({
        price: im.candle_high,
        color: edgeColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: '',
      }))

      // Zone bottom edge
      priceLines.current.push(seriesRef.current.createPriceLine({
        price: im.candle_low,
        color: edgeColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: '',
      }))

      // 50% midpoint — the key line
      priceLines.current.push(seriesRef.current.createPriceLine({
        price: mid,
        color: midColor,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${tfTag} ${isBull ? '▲' : '▼'} 50%`,
      }))
    }
  }, [imbalances, ticker, timeframe])

  const activeCount = imbalances.filter(
    (im) => im.ticker === ticker && im.status === 'ACTIVE'
  ).length

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
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                timeframe === tf
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-300 bg-[#0e0f15] border border-[#1f2133]'
              }`}
            >
              {tf}
              {tf === '4H' && <span className="ml-1 text-yellow-600 font-normal text-[10px]">(1H)</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto text-xs">
          {loading && <span className="text-gray-500 animate-pulse">Loading…</span>}
          {error && <span className="text-red-400">{error}</span>}
          {!loading && !error && (
            <span className="text-gray-600">
              {activeCount} active {ticker} level{activeCount !== 1 ? 's' : ''} shown
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="rounded-lg border border-[#1f2133] overflow-hidden"
        style={{ height: 520 }}
      />

      {/* Legend */}
      <div className="flex gap-6 text-xs text-gray-600">
        <span><span className="text-emerald-400 font-bold">- - ▲</span> Bullish demand zone midpoint</span>
        <span><span className="text-red-400 font-bold">- - ▼</span> Bearish supply zone midpoint</span>
        <span className="text-gray-700">Dotted lines = zone high/low boundaries</span>
        <span className="text-gray-700">All active {ticker} levels shown regardless of timeframe filter</span>
      </div>
    </div>
  )
}
