const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

const YF_TICKER = { SPX: '^GSPC', SPY: 'SPY', QQQ: 'QQQ' }

// Yahoo doesn't have 4H — use 1H bars instead
const TF_MAP = {
  '15m': { interval: '15m', range: '5d',  label: '15m' },
  '4H':  { interval: '1h',  range: '60d', label: '1H (4H proxy)' },
  '1D':  { interval: '1d',  range: '2y',  label: '1D' },
}

export const TF_LABEL = Object.fromEntries(Object.entries(TF_MAP).map(([k, v]) => [k, v.label]))

export async function fetchOHLC(ticker, timeframe) {
  const symbol = YF_TICKER[ticker] || ticker
  const tf = TF_MAP[timeframe] || TF_MAP['1D']

  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?interval=${tf.interval}&range=${tf.range}&includePrePost=false`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('No data in response')

  const { timestamp, indicators } = result
  const { open, high, low, close } = indicators.quote[0]

  return timestamp
    .map((t, i) => ({
      time: t,
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
    }))
    .filter((bar) => bar.open != null && bar.close != null)
}
