import type { ReactNode } from 'react'
import './CollapsibleSection.css'

type CollapsibleSectionProps = {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  return (
    <details className="collapsible-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="collapsible-section-content">{children}</div>
    </details>
  )
}
