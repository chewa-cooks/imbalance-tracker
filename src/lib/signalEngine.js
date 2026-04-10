export const calcMidpoint = (high, low) => (high + low) / 2

export const calcDistance = (price, midpoint) => Math.abs(price - midpoint)

export const calcPctToMidpoint = (price, midpoint) =>
  (Math.abs(price - midpoint) / price) * 100

export const isApproaching = (price, midpoint, threshold = 0.3) =>
  calcPctToMidpoint(price, midpoint) < threshold

export const getNetSignal = (price, midpoint, direction) => {
  if (direction === 'BULLISH') {
    return price >= midpoint ? 'NET_BUYERS' : 'WATCH_BUY'
  }
  return price <= midpoint ? 'NET_SELLERS' : 'WATCH_SELL'
}

export const detectUndercut = (prevClose, currClose, midpoint) =>
  prevClose !== null && prevClose < midpoint && currClose >= midpoint

// Returns a set of imbalance IDs that are overlapping
export const findOverlappingIds = (imbalances) => {
  const overlapping = new Set()
  for (let i = 0; i < imbalances.length; i++) {
    for (let j = i + 1; j < imbalances.length; j++) {
      const a = imbalances[i]
      const b = imbalances[j]
      if (a.candle_low <= b.candle_high && a.candle_high >= b.candle_low) {
        overlapping.add(a.id)
        overlapping.add(b.id)
      }
    }
  }
  return overlapping
}

// Count how many timeframes have an imbalance within threshold% of a given midpoint
export const calcConfluenceScore = (imbalances, midpoint, threshold = 0.005) => {
  const timeframes = ['15m', '4H', '1D']
  let score = 0
  for (const tf of timeframes) {
    const hit = imbalances.find(
      (im) =>
        im.timeframe === tf &&
        im.status === 'ACTIVE' &&
        Math.abs(calcMidpoint(im.candle_high, im.candle_low) - midpoint) / midpoint < threshold
    )
    if (hit) score++
  }
  return score
}

// Enrich a single imbalance with all calculated fields
export const enrichImbalance = (imbalance, price, allImbalances, overlappingIds, alertThreshold) => {
  const mid = calcMidpoint(imbalance.candle_high, imbalance.candle_low)
  const distance = calcDistance(price, mid)
  const pctToMidpoint = calcPctToMidpoint(price, mid)
  const approaching = isApproaching(price, mid, alertThreshold ?? 0.3)
  const signal = getNetSignal(price, mid, imbalance.direction)
  const confluence = calcConfluenceScore(allImbalances, mid)
  const overlapping = overlappingIds.has(imbalance.id)

  return {
    ...imbalance,
    midpoint: mid,
    distance,
    pctToMidpoint,
    approaching,
    signal,
    confluence,
    overlapping,
  }
}

// Determine if status should update based on current price
export const resolveStatus = (imbalance, price) => {
  const mid = calcMidpoint(imbalance.candle_high, imbalance.candle_low)
  if (imbalance.status !== 'ACTIVE') return imbalance.status
  if (price < imbalance.candle_low) return 'BROKEN'
  if (price > imbalance.candle_high && imbalance.direction === 'BEARISH') return 'FLIPPED'
  if (price < imbalance.candle_low && imbalance.direction === 'BULLISH') return 'BROKEN'
  return 'ACTIVE'
}
