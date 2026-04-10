// Vercel serverless function
// SPX: Barchart proxy → Cboe CDN fallback
// ES + NQ: Yahoo Finance with crumb auth (bypasses 429 rate limiting)

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// ── Yahoo Finance crumb auth ──────────────────────────────────────────────────
// Yahoo requires a crumb token + session cookie since 2023 — without it you get 429
async function getYahooCrumb() {
  const cookieRes = await fetch('https://fc.yahoo.com/', {
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
  })
  const rawCookie = cookieRes.headers.get('set-cookie') || ''
  // Pull out just the key=value pairs (strip attributes like Path, Expires, etc.)
  const cookie = rawCookie.split(',')
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')

  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookie },
  })
  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`)
  const crumb = (await crumbRes.text()).trim()
  if (!crumb || crumb.includes('<')) throw new Error('Yahoo crumb invalid')
  return { crumb, cookie }
}

// ── ES / NQ futures volume via Yahoo Finance ──────────────────────────────────
async function fetchFuturesVolume(ticker) {
  const { crumb, cookie } = await getYahooCrumb()
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d&includePrePost=false&crumb=${encodeURIComponent(crumb)}`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Cookie': cookie },
  })
  if (!res.ok) throw new Error(`Yahoo returned ${res.status} for ${ticker}`)

  const data = await res.json()
  const volumes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume || []
  const recent = [...volumes].reverse().find((v) => v != null && v > 0)
  if (!recent) throw new Error(`No volume data for ${ticker}`)
  return recent // raw contracts
}

// ── SPX options volume ────────────────────────────────────────────────────────
async function fetchSpxVolume() {
  // Attempt 1: Barchart's internal proxy API (no auth needed, returns JSON)
  try {
    const bcUrl = 'https://www.barchart.com/proxies/core-api/v1/quotes/get?symbols=%24SPX&fields=volume%2CoptionsTotalVolume%2CputCallRatio&raw=1'
    const r = await fetch(bcUrl, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://www.barchart.com/stocks/quotes/$SPX/options',
        'Accept': 'application/json',
      },
    })
    if (r.ok) {
      const d = await r.json()
      const row = d?.data?.[0]?.raw || d?.data?.[0]
      const vol = row?.optionsTotalVolume || row?.volume
      if (vol && vol > 10000) {
        // Convert contracts to $M (SPX options ~$100 multiplier, avg premium ~$5)
        const millions = Math.round((vol * 5) / 1_000_000 * 10) / 10
        return { contracts: vol, millions, source: 'barchart' }
      }
    }
  } catch {}

  // Attempt 2: Cboe CDN JSON endpoints
  const cdnUrls = [
    'https://cdn.cboe.com/api/global/us_options_market_statistics/daily_market_statistics.json',
    'https://cdn.cboe.com/api/global/us_options_market_statistics/market_statistics.json',
    'https://cdn.cboe.com/api/global/delayed_quotes/options/%24SPX.json',
  ]
  for (const url of cdnUrls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!r.ok) continue
      const d = await r.json()
      // Try to find SPX in the response under common shapes
      const candidates = [
        d?.data, d?.quotes, d?.results, d?.options, Object.values(d || {}),
      ].flat().filter(Boolean)
      const spx = candidates.find?.((x) =>
        typeof x === 'object' && (x?.symbol === 'SPX' || x?.ticker === 'SPX' || x?.underlying === 'SPX')
      )
      if (spx) {
        const vol = spx.volume ?? spx.totalVolume ?? spx.total_volume
        if (vol > 1000) {
          const millions = Math.round((vol * 5) / 1_000_000 * 10) / 10
          return { contracts: vol, millions, source: url }
        }
      }
    } catch {}
  }

  // Attempt 3: Yahoo Finance SPY options total volume as proxy
  try {
    const { crumb, cookie } = await getYahooCrumb()
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=5d&crumb=${encodeURIComponent(crumb)}`
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Cookie': cookie } })
    if (r.ok) {
      const d = await r.json()
      const vols = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume || []
      const vol = [...vols].reverse().find((v) => v != null && v > 0)
      if (vol) {
        // SPY volume (shares) — use as relative indicator, convert to rough $M
        const millions = Math.round(vol * 550 / 1_000_000 * 10) / 10 // ~$550/share
        return { contracts: vol, millions, source: 'yahoo-SPY-proxy', note: 'SPY share volume proxy' }
      }
    }
  } catch {}

  throw new Error('All SPX sources failed — enter manually from cboe.com')
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

  const [spxResult, esResult, nqResult] = await Promise.allSettled([
    fetchSpxVolume(),
    fetchFuturesVolume('ES=F'),
    fetchFuturesVolume('NQ=F'),
  ])

  res.json({
    timestamp: new Date().toISOString(),
    spx: spxResult.status === 'fulfilled'
      ? { millions: spxResult.value.millions, contracts: spxResult.value.contracts, source: spxResult.value.source, note: spxResult.value.note }
      : { error: spxResult.reason?.message },
    es: esResult.status === 'fulfilled'
      ? { contracts: esResult.value, thousands: Math.round(esResult.value / 1000), source: 'yahoo-ES=F' }
      : { error: esResult.reason?.message },
    nq: nqResult.status === 'fulfilled'
      ? { contracts: nqResult.value, thousands: Math.round(nqResult.value / 1000), source: 'yahoo-NQ=F' }
      : { error: nqResult.reason?.message },
  })
}
