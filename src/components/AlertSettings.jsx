export default function AlertSettings({ settings, onSave, onRequestPermission }) {
  const permission = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported'

  const toggle = (key) => onSave({ [key]: !settings[key] })

  const labelCls = 'text-sm text-gray-300'
  const descCls = 'text-xs text-gray-600 mt-0.5'

  return (
    <div className="max-w-md space-y-6">
      <h2 className="text-sm font-bold tracking-widest text-gray-500 uppercase">Alert Settings</h2>

      {/* Browser permission */}
      <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className={labelCls}>Browser Notifications</div>
            <div className={descCls}>
              {permission === 'granted' && '✓ Enabled'}
              {permission === 'denied' && '✗ Blocked — enable in browser settings'}
              {permission === 'default' && 'Click to request permission'}
              {permission === 'unsupported' && 'Not supported in this browser'}
            </div>
          </div>
          {permission === 'default' && (
            <button
              onClick={onRequestPermission}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-bold"
            >
              Enable
            </button>
          )}
          {permission === 'granted' && (
            <span className="text-emerald-400 text-xs font-bold">● LIVE</span>
          )}
        </div>
      </div>

      {/* Approach threshold */}
      <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4">
        <div className={labelCls + ' mb-2'}>Approach Alert Threshold</div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={settings.threshold}
            onChange={(e) => onSave({ threshold: parseFloat(e.target.value) })}
            className="flex-1 accent-emerald-500"
          />
          <span className="text-emerald-400 font-bold text-sm w-12 text-right">
            {settings.threshold.toFixed(1)}%
          </span>
        </div>
        <div className={descCls}>Alert when price is within {settings.threshold}% of any imbalance midpoint</div>
      </div>

      {/* Alert toggles */}
      <div className="rounded-lg border border-[#1f2133] bg-[#0e0f15] p-4 space-y-4">
        {[
          { key: 'notifyApproach', label: 'Price approaching midpoint', desc: `Within ${settings.threshold}% of the 50% line` },
          { key: 'notifyFlip',    label: 'Imbalance flip detected',     desc: 'Price crosses midpoint in either direction' },
          { key: 'notifyBroken',  label: 'Imbalance broken',            desc: 'Price closes outside the candle range' },
          { key: 'audioEnabled',  label: 'Audio ping',                  desc: 'Play a tone when an alert fires' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <div className={labelCls}>{label}</div>
              <div className={descCls}>{desc}</div>
            </div>
            <button
              onClick={() => toggle(key)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings[key] ? 'bg-emerald-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings[key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-700">
        Settings are saved locally on this device. Alerts fire during the current browser session.
      </div>
    </div>
  )
}
