import { useEffect, useState } from 'react'
import type { Board } from '../../domain/board'
import './BoardSettings.css'

type BoardSettingsProps = {
  board: Board
  showTitle?: boolean
  onApply: (board: Board) => void
}

function formatMillimeters(value: number): string {
  return Number(value.toFixed(2)).toString()
}

export function BoardSettings({
  board,
  showTitle = true,
  onApply,
}: BoardSettingsProps) {
  const [columns, setColumns] = useState(String(board.columns))
  const [rows, setRows] = useState(String(board.rows))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setColumns(String(board.columns))
    setRows(String(board.rows))
    setError(null)
  }, [board.columns, board.rows])

  const widthMm = (board.columns - 1) * board.pitchMm
  const heightMm = (board.rows - 1) * board.pitchMm

  function applyBoardSettings() {
    const nextColumns = Number(columns)
    const nextRows = Number(rows)

    if (
      !Number.isInteger(nextColumns) ||
      nextColumns <= 0 ||
      !Number.isInteger(nextRows) ||
      nextRows <= 0
    ) {
      setError('列数と行数は1以上の整数で入力してください。')
      return
    }

    setError(null)
    onApply({
      columns: nextColumns,
      rows: nextRows,
      pitchMm: board.pitchMm,
    })
  }

  return (
    <section
      className="board-settings"
      aria-label={showTitle ? undefined : '基板設定'}
      aria-labelledby={showTitle ? 'board-settings-title' : undefined}
    >
      {showTitle && <h2 id="board-settings-title">基板設定</h2>}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          applyBoardSettings()
        }}
      >
        <label>
          列数
          <input
            aria-label="基板の列数"
            inputMode="numeric"
            min="1"
            step="1"
            type="number"
            value={columns}
            onChange={(event) => setColumns(event.target.value)}
          />
        </label>
        <label>
          行数
          <input
            aria-label="基板の行数"
            inputMode="numeric"
            min="1"
            step="1"
            type="number"
            value={rows}
            onChange={(event) => setRows(event.target.value)}
          />
        </label>
        <button className="primary-button" type="submit">
          基板サイズを反映
        </button>
      </form>
      <p className="board-settings-size">
        穴の中心間: {formatMillimeters(widthMm)}mm ×{' '}
        {formatMillimeters(heightMm)}mm（{board.pitchMm}mmピッチ）
      </p>
      <p className="board-settings-notice">
        配置済みの部品または配線が基板外になるサイズには変更できません。
      </p>
      {error !== null && (
        <p className="board-settings-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
