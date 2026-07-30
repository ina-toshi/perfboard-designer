import {
  getWireEnd,
  getWireLabel,
  getWireStart,
  WIRE_COLOR_OPTIONS,
  type Wire,
  type WireKind,
  type WireSide,
} from '../../domain/wires'
import './WiringPanel.css'

type WireInspectorProps = {
  wire: Wire
  onChangeColor: (color: string) => void
  onChangeKind: (kind: WireKind) => void
  onChangeSide: (side: WireSide) => void
  onDelete: () => void
}

export function WireInspector({
  wire,
  onChangeColor,
  onChangeKind,
  onChangeSide,
  onDelete,
}: WireInspectorProps) {
  const start = getWireStart(wire)
  const end = getWireEnd(wire)

  return (
    <aside className="part-inspector wire-inspector" aria-label="配線設定">
      <h2>選択中の配線</h2>
      <p className="selected-wire-kind">{getWireLabel(wire.kind, wire.side)}</p>

      <label>
        配線種類
        <select
          value={wire.kind}
          onChange={(event) => onChangeKind(event.target.value as WireKind)}
        >
          <option value="jumper">ジャンパー線</option>
          <option value="solder">はんだ配線</option>
        </select>
      </label>

      <label>
        配線面
        <select
          value={wire.side}
          disabled={wire.kind === 'solder'}
          onChange={(event) => onChangeSide(event.target.value as WireSide)}
        >
          <option value="front">表面</option>
          <option value="back">裏面</option>
        </select>
      </label>

      <label>
        表示色
        <select
          value={wire.color}
          onChange={(event) => onChangeColor(event.target.value)}
        >
          {WIRE_COLOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <dl className="part-position wire-position">
        <div>
          <dt>始点</dt>
          <dd>
            列{start.column + 1}・行{start.row + 1}
          </dd>
        </div>
        <div>
          <dt>終点</dt>
          <dd>
            列{end.column + 1}・行{end.row + 1}
          </dd>
        </div>
      </dl>

      <button
        className="danger-button wire-delete-button"
        type="button"
        onClick={onDelete}
      >
        配線を削除
      </button>
    </aside>
  )
}
