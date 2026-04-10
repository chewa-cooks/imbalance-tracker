import { calcMidpoint } from '../lib/signalEngine'

function trinityStatus(ticker, imbalances, prices) {
  const price = prices[ticker]?.price
  if (!price) return null

  const active = imbalances.filter((im) => im.ticker === ticker && im.status === 'ACTIVE')
  if (!active.length) return null

  // Find the nearest imbalance
  const nearest = active.reduce((best, im) => {
    const mid = calcMidpoint(im.candle_high, im.candle_low)
    const dist = Math.abs(price - mid)
    return !best || dist < best.dist ? { im, mid, dist } : best
  }, null)

  if (!nearest) return null
  return price >= nearest.mid ? 'above' : 'below'
}

export default function TrinityStatusBar({ imbalances, prices }) {
  const tickers = ['SPX', 'SPY', 'QQQ']

  return (
    <div className="flex gap-3">
      {tickers.map((ticker) => {
        const status = trinityStatus(ticker, imbalances, prices)
        const price = prices[ticker]?.price
        const change = prices[ticker]?.change

        return (
          <div
            key={ticker}
            className="flex-1 rounded-lg border border-[#1f2133] bg-[#0e0f15] p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-bold tracking-widest">{ticker}</span>
              {status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    status === 'above'
                      ? 'bg-emerald-900/40 text-emerald-400'
                      : 'bg-red-900/40 text-red-400'
                  }`}
                >
                  {status === 'above' ? '▲ ABOVE' : '▼ BELOW'}
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-white">
              {price ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </div>
            {change !== null && change !== undefined && (
              <div className={`text-xs mt-0.5 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{change?.toFixed(2)}%
              </div>
            )}
            {!status && price && (
              <div className="text-xs text-gray-600 mt-0.5">no active levels</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
