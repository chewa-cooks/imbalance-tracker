const SIGNAL_LABELS = {
  NET_BUYERS:  { label: 'NET BUYERS',  cls: 'text-emerald-400' },
  NET_SELLERS: { label: 'NET SELLERS', cls: 'text-red-400' },
  WATCH_BUY:   { label: 'WATCH BUY',  cls: 'text-yellow-400' },
  WATCH_SELL:  { label: 'WATCH SELL', cls: 'text-yellow-400' },
}

const STATUS_CLS = {
  ACTIVE:   'text-emerald-400',
  FLIPPED:  'text-blue-400',
  BROKEN:   'text-red-500',
  ARCHIVED: 'text-gray-600',
}

function Stars({ count }) {
  return (
    <span className="text-yellow-400 text-xs">
      {'★'.repeat(count)}{'☆'.repeat(3 - count)}
    </span>
  )
}

export default function ImbalanceTable({ enriched, onEdit, onArchive, onDelete }) {
  const active = enriched.filter((im) => im.status === 'ACTIVE')
  const others = enriched.filter((im) => im.status !== 'ACTIVE')
  const rows = [...active, ...others]

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-8 text-center text-gray-600 text-sm">
        No imbalances tracked yet. Add your first level →
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1f2133] text-gray-500 uppercase tracking-wider">
            <th className="text-left px-3 py-2">Ticker</th>
            <th className="text-left px-3 py-2">TF</th>
            <th className="text-left px-3 py-2">Dir</th>
            <th className="text-right px-3 py-2">High</th>
            <th className="text-right px-3 py-2">Low</th>
            <th className="text-right px-3 py-2">50% Line</th>
            <th className="text-right px-3 py-2">Dist</th>
            <th className="text-center px-3 py-2">TFs</th>
            <th className="text-left px-3 py-2">Signal</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((im) => {
            const sig = SIGNAL_LABELS[im.signal] || {}
            const isApproaching = im.approaching && im.status === 'ACTIVE'
            const isOverlap = im.overlapping

            let rowCls = 'border-b border-[#1f2133] hover:bg-white/[0.02] transition-colors'
            if (isApproaching) rowCls += ' bg-orange-900/10'
            else if (im.direction === 'BULLISH' && im.status === 'ACTIVE') rowCls += ' bg-emerald-900/5'
            else if (im.direction === 'BEARISH' && im.status === 'ACTIVE') rowCls += ' bg-red-900/5'

            return (
              <tr key={im.id} className={rowCls}>
                <td className="px-3 py-2 font-bold text-white">{im.ticker}</td>
                <td className="px-3 py-2 text-gray-400">{im.timeframe}</td>
                <td className="px-3 py-2">
                  <span className={im.direction === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}>
                    {im.direction === 'BULLISH' ? '▲ BULL' : '▼ BEAR'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300">{im.candle_high?.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-gray-300">{im.candle_low?.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-bold text-white">
                  {im.midpoint?.toFixed(2)}
                  {isApproaching && <span className="ml-1 text-orange-400">●</span>}
                </td>
                <td className="px-3 py-2 text-right text-gray-400">
                  {im.pctToMidpoint !== undefined ? `${im.pctToMidpoint.toFixed(2)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <Stars count={im.confluence ?? 0} />
                </td>
                <td className="px-3 py-2">
                  {isOverlap ? (
                    <span className="text-yellow-400" title="Overlapping imbalances — wait for one to flip">⚠ OVERLAP</span>
                  ) : (
                    <span className={sig.cls}>{sig.label || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={STATUS_CLS[im.status] || 'text-gray-400'}>{im.status}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => onEdit(im)} className="text-gray-500 hover:text-white text-xs">Edit</button>
                    <button onClick={() => onArchive(im.id)} className="text-gray-500 hover:text-yellow-400 text-xs">Archive</button>
                    <button onClick={() => onDelete(im.id)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
