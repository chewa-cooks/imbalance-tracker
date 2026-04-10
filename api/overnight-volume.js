// Vercel serverless function — runs server-side, no CORS issues
// SPX: Cboe CDN JSON  |  ES + NQ: Yahoo Finance futures (ES=F, NQ=F)

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
}

// ── SPX Options Volume via Cboe CDN ─────────────────────────────────────────
async function fetchCboeSpxVolume() {
  // Cboe publishes daily exchange volume as JSON on their CDN
  const endpoints = [
    'https://cdn.cboe.com/api/global/us_options_market_statistics/daily_market_statistics.json',
    'https://cdn.cboe.com/api/global/us_options_market_statistics/market_statistics.json',
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS })
      if (!res.ok) continue
      const data = await res.json()

      // Navigate common Cboe JSON shapes
      const rows = data?.data || data?.market_statistics || data?.records || []
      const spx = Array.isArray(rows) && rows.find((r) =>
        r?.symbol === 'SPX' || r?.product === 'SPX' || r?.ticker === 'SPX' || r?.name === 'SPX'
      )

      if (spx) {
        const contracts = spx.volume ?? spx.total_volume ?? spx.call_volume + spx.put_volume ?? null
        if (contracts && contracts > 1000) {
          // Express as $M notional (SPX options are ~$100 multiplier, rough conversion)
          const millions = Math.round((contracts * 100) / 1_000_000 * 10) / 10
          return { contracts, millions, source: url }
        }
      }
    } catch {}
  }

  // Last resort: try OCC daily volume report (CSV, look for SPX row)
  const today = new Date()
  const ymd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const occUrl = `https://www.theocc.com/webapps/intraday-volume-download?reportDate=${ymd}`
  try {
    const r = await fetch(occUrl, { headers: BROWSER_HEADERS })
    if (r.ok) {
      const csv = await r.text()
      const line = csv.split('\n').find((l) => l.startsWith('SPX,') || l.includes(',SPX,'))
      if (line) {
        const cols = line.split(',')
        const vol = parseInt(cols.find((c) => /^\d{4,}$/.test(c.trim())))
        if (vol > 1000) {
          const millions = Math.round((vol * 100) / 1_000_000 * 10) / 10
          return { contracts: vol, millions, source: 'occ' }
        }
      }
    }
  } catch {}

  throw new Error('Cboe CDN and OCC returned no parseable SPX data — enter manually')
}

// ── ES / NQ Futures Volume via Yahoo Finance ──────────────────────────────────
// ES=F and NQ=F are the front-month E-mini futures tickers on Yahoo
async function fetchYahooFuturesVolume(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d&includePrePost=false`
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) throw new Error(`Yahoo Finance returned HTTP ${res.status} for ${ticker}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error(`No chart data for ${ticker}`)

  const volumes = result.indicators?.quote?.[0]?.volume || []
  // Get the most recent non-null volume (may include today's partial)
  const recent = [...volumes].reverse().find((v) => v != null && v > 0)
  if (!recent) throw new Error(`No volume data for ${ticker}`)

  return recent // raw contracts
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

  const [spxResult, esResult, nqResult] = await Promise.allSettled([
    fetchCboeSpxVolume(),
    fetchYahooFuturesVolume('ES=F'),
    fetchYahooFuturesVolume('NQ=F'),
  ])

  res.json({
    timestamp: new Date().toISOString(),
    spx: spxResult.status === 'fulfilled'
      ? { millions: spxResult.value.millions, contracts: spxResult.value.contracts, source: spxResult.value.source }
      : { error: spxResult.reason?.message },
    es: esResult.status === 'fulfilled'
      ? { contracts: esResult.value, thousands: Math.round(esResult.value / 1000), source: 'yahoo-ES=F' }
      : { error: esResult.reason?.message },
    nq: nqResult.status === 'fulfilled'
      ? { contracts: nqResult.value, thousands: Math.round(nqResult.value / 1000), source: 'yahoo-NQ=F' }
      : { error: nqResult.reason?.message },
  })
}
