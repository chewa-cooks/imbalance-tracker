import { useState, useMemo } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import VolumeTracker from './components/VolumeTracker'
import ImbalanceForm from './components/ImbalanceForm'
import AlertSettings from './components/AlertSettings'
import { useImbalances } from './hooks/useImbalances'
import { useMarketPrice } from './hooks/useMarketPrice'
import { useAlerts } from './hooks/useAlerts'
import { useOvernightVolume } from './hooks/useOvernightVolume'
import { enrichImbalance, findOverlappingIds } from './lib/signalEngine'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [editImbalance, setEditImbalance] = useState(null)

  const { imbalances, loading, error, addImbalance, updateImbalance, deleteImbalance, archiveImbalance } = useImbalances()
  const { prices, lastUpdated, priceError } = useMarketPrice()
  const { records, logVolume, deleteRecord } = useOvernightVolume()

  const enriched = useMemo(() => {
    const active = imbalances.filter((im) => im.status === 'ACTIVE')
    const overlappingIds = findOverlappingIds(active)
    return imbalances.map((im) => {
      const price = prices[im.ticker]?.price || prices.SPY?.price || 0
      return enrichImbalance(im, price, imbalances, overlappingIds, 0.3)
    })
  }, [imbalances, prices])

  const { settings, saveSettings, requestPermission } = useAlerts(enriched)

  const handleEdit = (im) => {
    setEditImbalance(im)
    setTab('add')
  }

  const handleSave = async (fields, id) => {
    if (id) await updateImbalance(id, fields)
    else await addImbalance(fields)
    setEditImbalance(null)
    setTab('dashboard')
  }

  const handleCancel = () => {
    setEditImbalance(null)
    setTab('dashboard')
  }

  const handleTabChange = (newTab) => {
    if (newTab !== 'add') setEditImbalance(null)
    setTab(newTab)
  }

  return (
    <Layout activeTab={tab} onTabChange={handleTabChange}>
      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-600 text-sm animate-pulse">
          Loading…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/30 bg-red-900/20 text-red-400 text-sm px-4 py-3 mb-4">
          Supabase error: {error}
          <div className="text-xs mt-1 text-red-500">
            Make sure you ran the SQL to create the imbalances table in your Supabase project.
          </div>
        </div>
      )}

      {!loading && tab === 'dashboard' && (
        <Dashboard
          imbalances={imbalances}
          prices={prices}
          lastUpdated={lastUpdated}
          priceError={priceError}
          onEdit={handleEdit}
          onArchive={archiveImbalance}
          onDelete={deleteImbalance}
          alertThreshold={settings.threshold}
        />
      )}

      {tab === 'volume' && (
        <VolumeTracker
          records={records}
          onLog={logVolume}
          onDelete={deleteRecord}
        />
      )}

      {tab === 'add' && (
        <ImbalanceForm
          editImbalance={editImbalance}
          onSave={handleSave}
          onCancel={editImbalance ? handleCancel : null}
        />
      )}

      {tab === 'alerts' && (
        <AlertSettings
          settings={settings}
          onSave={saveSettings}
          onRequestPermission={requestPermission}
        />
      )}
    </Layout>
  )
}
