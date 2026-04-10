const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chart',     label: 'Chart' },
  { id: 'add',       label: '+ Add Level' },
  { id: 'alerts',    label: 'Alerts' },
]

export default function Layout({ activeTab, onTabChange, children }) {
  return (
    <div className="min-h-screen bg-[#050508] text-gray-100 flex flex-col">
      {/* Top nav */}
      <nav className="border-b border-[#1f2133] bg-[#0a0b10]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-12">
          <span className="text-white font-bold text-sm mr-6 tracking-widest uppercase">
            IMB<span className="text-emerald-400">TRACKER</span>
          </span>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-1.5 rounded text-xs font-medium tracking-wide transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
