import {
  PART_DEFINITIONS,
  PART_KIND_ORDER,
  type PartKind,
} from '../../domain/parts'
import './PartsPanel.css'

type PartPaletteProps = {
  activeKind: PartKind | null
  movingPart: boolean
  showTitle?: boolean
  onChoosePart: (kind: PartKind) => void
  onCancelPlacement: () => void
}

export function PartPalette({
  activeKind,
  movingPart,
  showTitle = true,
  onChoosePart,
  onCancelPlacement,
}: PartPaletteProps) {
  const placementActive = activeKind !== null || movingPart

  return (
    <section
      className="parts-panel-section"
      aria-label={showTitle ? undefined : '部品パレット'}
      aria-labelledby={showTitle ? 'part-palette-title' : undefined}
    >
      {showTitle && <h2 id="part-palette-title">部品パレット</h2>}
      <div className="part-palette">
        {PART_KIND_ORDER.map((kind) => (
          <button
            key={kind}
            className={activeKind === kind ? 'is-active' : undefined}
            type="button"
            aria-pressed={activeKind === kind}
            onClick={() => onChoosePart(kind)}
          >
            <strong>{PART_DEFINITIONS[kind].name}</strong>
            <span>{PART_DEFINITIONS[kind].description}</span>
          </button>
        ))}
      </div>
      {placementActive && (
        <div className="placement-notice">
          <p>
            {movingPart
              ? '移動先の穴を選んでください。'
              : '配置する基板穴を選んでください。'}
          </p>
          <button type="button" onClick={onCancelPlacement}>
            配置を中止
          </button>
          <span>Escapeキーでも中止できます</span>
        </div>
      )}
    </section>
  )
}
