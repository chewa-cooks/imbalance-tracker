import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calcMidpoint } from '../lib/signalEngine'

export function useImbalances() {
  const [imbalances, setImbalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('imbalances')
      .select('*')
      .order('date_formed', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setImbalances(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    // Real-time sync across devices
    const channel = supabase
      .channel('imbalances-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imbalances' }, () => {
        load()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  const addImbalance = useCallback(async (fields) => {
    const record = {
      ticker: fields.ticker,
      timeframe: fields.timeframe,
      candle_high: parseFloat(fields.candle_high),
      candle_low: parseFloat(fields.candle_low),
      direction: fields.direction,
      date_formed: fields.date_formed,
      status: 'ACTIVE',
      notes: fields.notes || '',
    }
    const { error } = await supabase.from('imbalances').insert(record)
    if (error) throw new Error(error.message)
    await load()
  }, [load])

  const updateImbalance = useCallback(async (id, fields) => {
    const updates = { ...fields }
    if (updates.candle_high) updates.candle_high = parseFloat(updates.candle_high)
    if (updates.candle_low) updates.candle_low = parseFloat(updates.candle_low)
    const { error } = await supabase.from('imbalances').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
    await load()
  }, [load])

  const deleteImbalance = useCallback(async (id) => {
    const { error } = await supabase.from('imbalances').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await load()
  }, [load])

  const archiveImbalance = useCallback(async (id) => {
    await updateImbalance(id, { status: 'ARCHIVED' })
  }, [updateImbalance])

  return { imbalances, loading, error, addImbalance, updateImbalance, deleteImbalance, archiveImbalance }
}
