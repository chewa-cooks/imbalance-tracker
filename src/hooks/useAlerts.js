import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'imbalance-alert-settings'

const defaultSettings = {
  threshold: 0.3,    // % to midpoint
  audioEnabled: true,
  notifyApproach: true,
  notifyFlip: true,
  notifyBroken: true,
}

export function useAlerts(enrichedImbalances) {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    } catch {
      return defaultSettings
    }
  })

  const firedRef = useRef(new Set()) // track which alerts already fired this session
  const audioRef = useRef(null)

  const saveSettings = useCallback((updates) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  const playPing = useCallback(() => {
    if (!settings.audioEnabled) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch {}
  }, [settings.audioEnabled])

  const notify = useCallback((title, body, key) => {
    if (firedRef.current.has(key)) return
    firedRef.current.add(key)

    playPing()

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }, [playPing])

  useEffect(() => {
    if (!enrichedImbalances?.length) return

    for (const im of enrichedImbalances) {
      if (im.status !== 'ACTIVE') continue

      if (settings.notifyApproach && im.approaching) {
        notify(
          `⚡ ${im.ticker} Approaching Imbalance`,
          `${im.timeframe} ${im.direction} imbalance — 50% at ${im.midpoint?.toFixed(2)}`,
          `approach-${im.id}`
        )
      }

      if (settings.notifyFlip && im.signal === 'NET_BUYERS' && im.direction === 'BULLISH') {
        // Only alert on fresh flips (price just crossed midpoint)
      }
    }
  }, [enrichedImbalances, settings, notify])

  // Clear fired alerts each day so they re-fire next session
  useEffect(() => {
    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)
    const ms = midnight - new Date()
    const t = setTimeout(() => { firedRef.current.clear() }, ms)
    return () => clearTimeout(t)
  }, [])

  return { settings, saveSettings, requestPermission }
}
