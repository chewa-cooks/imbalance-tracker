// Vercel serverless function — runs server-side, no CORS issues
// Fetches overnight/pre-market volume from Cboe (SPX) and CME (ES, NQ)

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

// Parse a number string like "1,234,567" → 1234567
function parseNum(str) {
  if (!str) return null
  const n = parseFloat(str.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

// ── SPX Options Volume via Cboe ──────────────────────────────────────────────
async function fetchCboeSpxVolume() {
  // Cboe publishes daily market stats as a publicly accessible page
  const url = 'https://www.cboe.com/us/options/market_statistics/daily/'
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`Cboe returned HTTP ${res.status}`)

  const html = await res.text()

  // Cboe's page has a table. SPX row typically looks like:
  // <td ...>SPX</td><td ...>1,234,567</td>...
  // Try several regex patterns to find it
  const patterns = [
    /SPX<\/td>\s*<td[^>]*>\s*([\d,]+)/i,
    />SPX<[^>]+>\s*<[^>]+>\s*([\d,]+)/i,
    /["']SPX["'][^}]*volume["']:\s*([\d.]+)/i,
    /SPX.*?([\d]{1,3}(?:,[\d]{3})+)/,
  ]

  for (const pat of patterns) {
    const m = html.match(pat)
    if (m) {
      const raw = parseNum(m[1])
      if (raw && raw > 10000) {
        // Convert raw contract count to $M notional (rough: SPX ~$50 per contract value unit)
        // Cboe shows total contracts — return as-is in thousands for the user to interpret
        return { contracts: raw, millions: Math.round(raw / 1000 * 10) / 10 }
      }
    }
  }

  // Fallback: try Cboe's CDN JSON endpoint
  const jsonUrl = 'https://cdn.cboe.com/api/global/us_options_market_statistics/daily_market_statistics.json'
  const jr = await fetch(jsonUrl, { headers: HEADERS })
  if (jr.ok) {
    const data = await jr.json()
    // Look for SPX in the data
    const spx = data?.data?.find?.((d) => d.symbol === 'SPX' || d.ticker === 'SPX')
    if (spx) {
      const vol = spx.volume || spx.totalVolume || spx.call_volume + spx.put_volume
      if (vol) return { contracts: vol, millions: Math.round(vol / 1000 * 10) / 10 }
    }
  }

  throw new Error('Could not parse SPX volume from Cboe — page structure may have changed')
}

// ── ES Futures Volume via CME ────────────────────────────────────────────────
async function fetchCmeFuturesVolume(symbol) {
  // CME Group publishes volume data via their web API
  const today = new Date()
  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const dateStr = fmt(today)

  // CME's volume endpoint (reverse engineered from their website)
  const url = `https://www.cmegroup.com/CmeWS/mvc/Volume/Summary/I?tradeDate=${dateStr}&exchange=CME`
  const res = await fetch(url, { headers: { ...HEADERS, 'Referer': 'https://www.cmegroup.com/' } })

  if (!res.ok) throw new Error(`CME returned HTTP ${res.status}`)
  const data = await res.json()

  // CME response has an array of products
  const items = data?.volumeSummary || data?.items || data || []
  const row = Array.isArray(items) && items.find((r) =>
    r.productName?.includes(symbol) || r.name?.includes(symbol) || r.globexCode === symbol
  )

  if (row) {
    const vol = parseNum(String(row.volume || row.totalVolume || row.globexVol || ''))
    if (vol) return vol
  }
  throw new Error(`Could not find ${symbol} in CME response`)
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600') // cache 5 min

  const [spxResult, esResult, nqResult] = await Promise.allSettled([
    fetchCboeSpxVolume(),
    fetchCmeFuturesVolume('E-Mini S&P'),
    fetchCmeFuturesVolume('E-Mini Nasdaq'),
  ])

  const out = {
    timestamp: new Date().toISOString(),
    spx: spxResult.status === 'fulfilled'
      ? { ...spxResult.value, source: 'cboe' }
      : { error: spxResult.reason?.message },
    es: esResult.status === 'fulfilled'
      ? { contracts: esResult.value, source: 'cme' }
      : { error: esResult.reason?.message },
    nq: nqResult.status === 'fulfilled'
      ? { contracts: nqResult.value, source: 'cme' }
      : { error: nqResult.reason?.message },
  }

  res.json(out)
}
