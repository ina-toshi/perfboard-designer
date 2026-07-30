import type { ReactNode } from 'react'
import './InspectorTabs.css'

export type InspectorTab = 'part' | 'wire' | 'net' | 'connectivity'

const TAB_LABELS: Record<InspectorTab, string> = {
  part: '部品',
  wire: '配線',
  net: 'ネット',
  connectivity: '接続検査',
}

type InspectorTabsProps = {
  activeTab: InspectorTab
  highlightLabel: string | null
  onChangeTab: (tab: InspectorTab) => void
  onClearHighlight: () => void
  children: ReactNode
}

export function InspectorTabs({
  activeTab,
  highlightLabel,
  onChangeTab,
  onClearHighlight,
  children,
}: InspectorTabsProps) {
  return (
    <aside className="inspector-tabs" aria-label="設定と接続検査">
      <div className="inspector-tab-list" role="tablist" aria-label="設定項目">
        {(Object.keys(TAB_LABELS) as InspectorTab[]).map((tab) => (
          <button
            key={tab}
            id={`inspector-tab-${tab}`}
            className={activeTab === tab ? 'is-active' : undefined}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="inspector-tab-panel"
            onClick={() => onChangeTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {highlightLabel !== null && (
        <div className="highlight-status" role="status">
          <span>基板強調: {highlightLabel}</span>
          <button type="button" onClick={onClearHighlight}>
            強調を解除
          </button>
        </div>
      )}

      <div
        id="inspector-tab-panel"
        className="inspector-tab-scroll"
        role="tabpanel"
        aria-labelledby={`inspector-tab-${activeTab}`}
      >
        {children}
      </div>
    </aside>
  )
}
