const API_KEY = import.meta.env.VITE_POLYGON_API_KEY
const BASE = 'https://api.polygon.io'

// Polygon ticker mapping
const PRICE_TICKER = { SPX: 'I:SPX', SPY: 'SPY', QQQ: 'QQQ' }
const CHART_TICKER = { SPX: 'SPY', SPY: 'SPY', QQQ: 'QQQ' } // SPY proxy for SPX chart

const TF_MAP = {
  '15m': { multiplier: 15, timespan: 'minute' },
  '4H':  { multiplier: 4,  timespan: 'hour'   },
  '1D':  { multiplier: 1,  timespan: 'day'    },
}

export async function fetchPrices() {
  const results = {}

  // Fetch stocks (SPY, QQQ)
  const stockRes = await fetch(
    `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=SPY,QQQ&apiKey=${API_KEY}`
  )
  const stockData = await stockRes.json()
  if (stockData.tickers) {
    for (const t of stockData.tickers) {
      const price = t.day?.c || t.lastTrade?.p || t.prevDay?.c || null
      const change = t.todaysChangePerc ?? null
      results[t.ticker] = { price, change }
    }
  }

  // Fetch SPX index
  const idxRes = await fetch(
    `${BASE}/v3/snapshot/indices?ticker.any_of=I:SPX&apiKey=${API_KEY}`
  )
  const idxData = await idxRes.json()
  if (idxData.results?.length) {
    const spx = idxData.results[0]
    results['SPX'] = {
      price: spx.value ?? spx.session?.close ?? null,
      change: spx.session?.changePercent ?? null,
    }
  }

  return results // { SPY: { price, change }, QQQ: { price, change }, SPX: { price, change } }
}

export async function fetchOHLC(ticker, timeframe) {
  const chartTicker = CHART_TICKER[ticker] || ticker
  const tf = TF_MAP[timeframe]
  if (!tf) return []

  const today = new Date()
  const from = new Date(today)

  // Look back enough bars
  if (timeframe === '15m') from.setDate(from.getDate() - 5)
  else if (timeframe === '4H') from.setDate(from.getDate() - 30)
  else from.setFullYear(from.getFullYear() - 1)

  const fmt = (d) => d.toISOString().split('T')[0]

  const url = `${BASE}/v2/aggs/ticker/${chartTicker}/range/${tf.multiplier}/${tf.timespan}/${fmt(from)}/${fmt(today)}?adjusted=true&sort=asc&limit=500&apiKey=${API_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  if (!data.results) return []

  return data.results.map((bar) => ({
    time: Math.floor(bar.t / 1000), // Polygon uses ms, lightweight-charts uses seconds
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
  }))
}
