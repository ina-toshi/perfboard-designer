import './SvgExportControls.css'

type SvgExportControlsProps = {
  mirrorBack: boolean
  showPartLabels: boolean
  busy: boolean
  disabled: boolean
  showTitle?: boolean
  message: string | null
  error: string | null
  onExportFront: () => void
  onExportBack: () => void
}

export function SvgExportControls({
  mirrorBack,
  showPartLabels,
  busy,
  disabled,
  showTitle = true,
  message,
  error,
  onExportFront,
  onExportBack,
}: SvgExportControlsProps) {
  return (
    <section
      className="svg-export-controls"
      aria-label={showTitle ? undefined : '組み立て図の出力'}
      aria-labelledby={showTitle ? 'svg-export-title' : undefined}
    >
      {showTitle && <h2 id="svg-export-title">組み立て図の出力</h2>}
      <div className="svg-export-buttons">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onExportFront}
        >
          表面SVGを出力
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onExportBack}
        >
          裏面SVGを出力
        </button>
      </div>
      <p className="svg-export-orientation">
        裏面: {mirrorBack ? '左右反転あり' : '左右反転なし'}
      </p>
      <p className="svg-export-orientation">
        部品ラベル: {showPartLabels ? '表示' : '非表示'}
      </p>
      <p className="svg-print-note">
        実寸確認・印刷時は、拡大縮小なしの100%を指定してください。
      </p>
      {busy && (
        <p className="svg-export-operation" role="status">
          SVGファイルを出力中です…
        </p>
      )}
      {message !== null && (
        <p className="svg-export-message" role="status">
          {message}
        </p>
      )}
      {error !== null && (
        <p className="svg-export-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
