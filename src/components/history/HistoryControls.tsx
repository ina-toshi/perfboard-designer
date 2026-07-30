import './HistoryControls.css'

type HistoryControlsProps = {
  undoCount: number
  redoCount: number
  onUndo: () => void
  onRedo: () => void
}

export function HistoryControls({
  undoCount,
  redoCount,
  onUndo,
  onRedo,
}: HistoryControlsProps) {
  return (
    <section className="history-controls" aria-labelledby="history-title">
      <h2 id="history-title">操作履歴</h2>
      <div className="history-buttons">
        <button
          type="button"
          disabled={undoCount === 0}
          aria-keyshortcuts="Meta+Z Control+Z"
          onClick={onUndo}
        >
          元に戻す
        </button>
        <button
          type="button"
          disabled={redoCount === 0}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
          onClick={onRedo}
        >
          やり直す
        </button>
      </div>
      <p className="history-status" role="status">
        Undo: {undoCount}件 / Redo: {redoCount}件
      </p>
    </section>
  )
}
