import { useEffect, useState } from 'react'
import {
  CONFIGURABLE_PIN_COUNTS,
  DIP_PIN_COUNTS,
  LED_COLORS,
  LED_COLOR_LABELS,
  PART_DEFINITIONS,
  type ConfigurablePinCount,
  type DipPinCount,
  type LedColor,
  type Part,
  type PinHeaderColumns,
  type PinHeaderGender,
  type PinHeaderNumbering,
} from '../../domain/parts'
import './PartsPanel.css'

type PartInspectorProps = {
  part: Part | null
  onApplySettings: (settings: { reference: string; value: string }) => void
  onChangeDipPinCount: (pinCount: DipPinCount) => void
  onChangeCapacitorPolarity: (polarized: boolean) => void
  onChangeLedColor: (color: LedColor) => void
  onChangePinHeaderColumns: (columns: PinHeaderColumns) => void
  onChangePinHeaderGender: (gender: PinHeaderGender) => void
  onChangePinHeaderNumbering: (numbering: PinHeaderNumbering) => void
  onChangePinCount: (pinCount: ConfigurablePinCount) => void
  onRotate: () => void
  onDelete: () => void
}

export function PartInspector({
  part,
  onApplySettings,
  onChangeDipPinCount,
  onChangeCapacitorPolarity,
  onChangeLedColor,
  onChangePinHeaderColumns,
  onChangePinHeaderGender,
  onChangePinHeaderNumbering,
  onChangePinCount,
  onRotate,
  onDelete,
}: PartInspectorProps) {
  const [reference, setReference] = useState('')
  const [value, setValue] = useState('')

  useEffect(() => {
    setReference(part?.reference ?? '')
    setValue(part?.value ?? '')
  }, [part?.id, part?.reference, part?.value])

  if (part === null) {
    return (
      <aside className="part-inspector" aria-label="部品設定">
        <h2>選択中の部品</h2>
        <p>
          選択ツールで基板上の部品または配線を選択すると、ここで設定を変更できます。
        </p>
      </aside>
    )
  }

  return (
    <aside className="part-inspector" aria-label="部品設定">
      <h2>選択中の部品</h2>
      <p className="selected-part-kind">{PART_DEFINITIONS[part.kind].name}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onApplySettings({ reference, value })
        }}
      >
        <label>
          部品番号
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </label>
        <label>
          値・表示名
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        {part.kind === 'dip' && (
          <label>
            端子数
            <select
              value={part.pinCount}
              onChange={(event) =>
                onChangeDipPinCount(Number(event.target.value) as DipPinCount)
              }
            >
              {DIP_PIN_COUNTS.map((pinCount) => (
                <option key={pinCount} value={pinCount}>
                  {pinCount}端子
                </option>
              ))}
            </select>
          </label>
        )}
        {part.kind === 'capacitor' && (
          <label>
            極性
            <select
              value={part.polarized ? 'polarized' : 'non-polarized'}
              onChange={(event) =>
                onChangeCapacitorPolarity(event.target.value === 'polarized')
              }
            >
              <option value="non-polarized">無極性</option>
              <option value="polarized">極性あり</option>
            </select>
          </label>
        )}
        {part.kind === 'led' && (
          <label>
            発光色
            <select
              value={part.color}
              onChange={(event) =>
                onChangeLedColor(event.target.value as LedColor)
              }
            >
              {LED_COLORS.map((color) => (
                <option key={color} value={color}>
                  {LED_COLOR_LABELS[color]}
                </option>
              ))}
            </select>
          </label>
        )}
        {part.kind === 'tactile-switch' && (
          <p className="part-inspector-notice">
            外形は6 × 6
            mmです。端子の間には1穴を空けます。上側のA1・A2と下側のB1・B2を、それぞれ別の導通グループとして扱います。
          </p>
        )}
        {part.kind === 'pin-header' && (
          <>
            <label>
              種類
              <select
                value={part.gender}
                onChange={(event) =>
                  onChangePinHeaderGender(event.target.value as PinHeaderGender)
                }
              >
                <option value="male">オス</option>
                <option value="female">メス</option>
              </select>
            </label>
            <label>
              列数
              <select
                value={part.columns}
                onChange={(event) =>
                  onChangePinHeaderColumns(
                    Number(event.target.value) as PinHeaderColumns,
                  )
                }
              >
                <option value={1}>1列</option>
                <option value={2}>2列</option>
              </select>
            </label>
            <label>
              端子番号
              <select
                value={part.numbering}
                onChange={(event) =>
                  onChangePinHeaderNumbering(
                    event.target.value as PinHeaderNumbering,
                  )
                }
              >
                <option value="normal">1番から順番</option>
                <option value="reversed">反転（最大番号から）</option>
              </select>
            </label>
          </>
        )}
        {(part.kind === 'pin-header' || part.kind === 'connector') && (
          <label>
            端子数
            <select
              value={part.pinCount}
              onChange={(event) =>
                onChangePinCount(
                  Number(event.target.value) as ConfigurablePinCount,
                )
              }
            >
              {CONFIGURABLE_PIN_COUNTS.filter(
                (pinCount) =>
                  part.kind !== 'pin-header' ||
                  part.columns === 1 ||
                  pinCount % 2 === 0,
              ).map((pinCount) => (
                <option key={pinCount} value={pinCount}>
                  {pinCount}端子
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="primary-button" type="submit">
          設定を反映
        </button>
      </form>

      <dl className="part-position">
        <div>
          <dt>基準穴</dt>
          <dd>
            列{part.origin.column + 1}・行{part.origin.row + 1}
          </dd>
        </div>
        <div>
          <dt>回転</dt>
          <dd>{part.rotation}度</dd>
        </div>
      </dl>

      <div className="part-actions">
        <button type="button" onClick={onRotate}>
          90度回転
        </button>
        <button className="danger-button" type="button" onClick={onDelete}>
          削除
        </button>
      </div>
    </aside>
  )
}
