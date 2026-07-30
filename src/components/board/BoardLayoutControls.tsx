import type { GridOffset } from '../../domain/board'
import './BoardLayoutControls.css'

type BoardLayoutControlsProps = {
  disabled: boolean
  showTitle?: boolean
  onMove: (offset: GridOffset) => void
}

const DIRECTION_BUTTONS: Array<{
  label: string
  offset: GridOffset
  className: string
}> = [
  { label: '上へ1穴移動', offset: { column: 0, row: -1 }, className: 'up' },
  { label: '左へ1穴移動', offset: { column: -1, row: 0 }, className: 'left' },
  { label: '右へ1穴移動', offset: { column: 1, row: 0 }, className: 'right' },
  { label: '下へ1穴移動', offset: { column: 0, row: 1 }, className: 'down' },
]

export function BoardLayoutControls({
  disabled,
  showTitle = true,
  onMove,
}: BoardLayoutControlsProps) {
  return (
    <section
      className="board-layout-controls"
      aria-label={showTitle ? undefined : '配置全体を移動'}
      aria-labelledby={showTitle ? 'layout-title' : undefined}
    >
      {showTitle && <h2 id="layout-title">配置全体を移動</h2>}
      <p>部品と配線をまとめて1穴ずつ移動します。</p>
      <div className="layout-direction-buttons" aria-label="配置全体を移動">
        {DIRECTION_BUTTONS.map(({ label, offset, className }) => (
          <button
            key={label}
            className={className}
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            onClick={() => onMove(offset)}
          >
            {className === 'up'
              ? '↑'
              : className === 'left'
                ? '←'
                : className === 'right'
                  ? '→'
                  : '↓'}
          </button>
        ))}
      </div>
      {disabled && (
        <p className="layout-disabled-notice" role="status">
          部品の配置または配線の作成中は移動できません。
        </p>
      )}
    </section>
  )
}
