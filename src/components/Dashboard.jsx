import { useMemo } from 'react'
import TrinityStatusBar from './TrinityStatusBar'
import OvernightVolumePanel from './OvernightVolumePanel'
import ImbalanceTable from './ImbalanceTable'
import { enrichImbalance, findOverlappingIds, calcMidpoint } from '../lib/signalEngine'

export default function Dashboard({ imbalances, prices, lastUpdated, priceError, onEdit, onArchive, onDelete, alertThreshold }) {
  // Use SPY price as proxy for SPX if SPX not available
  const getPrice = (ticker) => {
    if (ticker === 'SPX') return prices.SPX?.price || prices.SPY?.price
    return prices[ticker]?.price
  }

  const enriched = useMemo(() => {
    const active = imbalances.filter((im) => im.status === 'ACTIVE')
    const overlappingIds = findOverlappingIds(active)

    return imbalances.map((im) => {
      const price = getPrice(im.ticker) || 0
      return enrichImbalance(im, price, imbalances, overlappingIds, alertThreshold)
    }).sort((a, b) => {
      // Active first, then sort by distance
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1
      return (a.distance ?? Infinity) - (b.distance ?? Infinity)
    })
  }, [imbalances, prices, alertThreshold])

  const fmt = (d) => d?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="space-y-4">
      {/* Price header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-widest text-gray-500 uppercase">Live Dashboard</h1>
        <div className="text-xs text-gray-600">
          {priceError
            ? <span className="text-red-500">{priceError}</span>
            : lastUpdated
            ? `Updated ${fmt(lastUpdated)}`
            : 'Loading prices…'}
        </div>
      </div>

      {/* Trinity bar */}
      <TrinityStatusBar imbalances={imbalances} prices={prices} />

      {/* Overnight volume + table */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-1">
          <OvernightVolumePanel />
        </div>
        <div className="xl:col-span-3">
          <ImbalanceTable
            enriched={enriched}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  )
}
