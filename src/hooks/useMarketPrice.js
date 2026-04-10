import { useState, useEffect, useRef } from 'react'
import { fetchPrices } from '../lib/polygon'

const POLL_INTERVAL = 15_000 // 15 seconds per spec

export function useMarketPrice() {
  const [prices, setPrices] = useState({ SPX: null, SPY: null, QQQ: null })
  const [lastUpdated, setLastUpdated] = useState(null)
  const [priceError, setPriceError] = useState(null)
  const timerRef = useRef(null)

  const poll = async () => {
    try {
      const data = await fetchPrices()
      setPrices((prev) => ({ ...prev, ...data }))
      setLastUpdated(new Date())
      setPriceError(null)
    } catch (e) {
      setPriceError('Price fetch failed — check API key or market hours')
    }
  }

  useEffect(() => {
    poll()
    timerRef.current = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [])

  return { prices, lastUpdated, priceError }
}
