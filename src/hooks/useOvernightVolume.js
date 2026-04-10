import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOvernightVolume() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('overnight_volume')
      .select('*')
      .order('date', { ascending: false })
      .limit(20)

    if (error) setError(error.message)
    else setRecords(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('overnight-volume-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overnight_volume' }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  const logVolume = useCallback(async (fields) => {
    const record = {
      date: fields.date,
      spx_vol: fields.spx_vol !== '' ? parseFloat(fields.spx_vol) : null,
      es_vol:  fields.es_vol  !== '' ? parseFloat(fields.es_vol)  : null,
      nq_vol:  fields.nq_vol  !== '' ? parseFloat(fields.nq_vol)  : null,
      notes:   fields.notes || null,
    }
    // Upsert by date so re-logging today overwrites
    const { error } = await supabase
      .from('overnight_volume')
      .upsert(record, { onConflict: 'date' })

    if (error) throw new Error(error.message)
    await load()
  }, [load])

  const deleteRecord = useCallback(async (id) => {
    const { error } = await supabase.from('overnight_volume').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await load()
  }, [load])

  return { records, loading, error, logVolume, deleteRecord }
}
