export type Tab = 'avui' | 'progres' | 'compte'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'avui', label: 'Avui', icon: 'M4 12h3l2-6 4 12 2-6h5' },
  { id: 'progres', label: 'Progrés', icon: 'M4 19V5M4 19h16M8 15l4-4 3 3 5-6' },
  { id: 'compte', label: 'Compte', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Seccions">
      {TABS.map((t) => (
        <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onChange(t.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
