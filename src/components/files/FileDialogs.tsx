import './FileDialogs.css'

export type PendingUnsavedAction = 'new' | 'open' | 'close'

const UNSAVED_ACTION_LABELS: Record<PendingUnsavedAction, string> = {
  new: '新しい設計を作成',
  open: '別の設計ファイルを開く',
  close: 'アプリを閉じる',
}

type UnsavedChangesDialogProps = {
  action: PendingUnsavedAction
  busy: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  action,
  busy,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <div className="dialog-backdrop">
      <section
        className="file-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-description"
      >
        <h2 id="unsaved-title">未保存の変更があります</h2>
        <p id="unsaved-description">
          {UNSAVED_ACTION_LABELS[action]}前に、現在の設計を保存しますか？
        </p>
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onSave}>
            保存
          </button>
          <button type="button" disabled={busy} onClick={onDiscard}>
            保存しない
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </section>
    </div>
  )
}

type RecoveryDialogProps = {
  savedAt: string
  designName: string
  busy: boolean
  onRestore: () => void
  onDiscard: () => void
}

export function RecoveryDialog({
  savedAt,
  designName,
  busy,
  onRestore,
  onDiscard,
}: RecoveryDialogProps) {
  return (
    <div className="dialog-backdrop">
      <section
        className="file-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        aria-describedby="recovery-description"
      >
        <h2 id="recovery-title">復旧できる設計があります</h2>
        <p id="recovery-description">
          「{designName}」の未保存データが見つかりました。
          <br />
          自動保存日時: {new Date(savedAt).toLocaleString('ja-JP')}
        </p>
        <p>
          復元しても元の設計ファイルは上書きされません。復元後に保存先を選んでください。
        </p>
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onRestore}>
            復元する
          </button>
          <button type="button" disabled={busy} onClick={onDiscard}>
            破棄する
          </button>
        </div>
      </section>
    </div>
  )
}
