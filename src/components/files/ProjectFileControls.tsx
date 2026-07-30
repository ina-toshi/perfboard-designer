import { useEffect, useState, type FormEvent } from 'react'
import './ProjectFileControls.css'

type ProjectFileControlsProps = {
  designName: string
  fileName: string
  dirty: boolean
  busy: boolean
  operationLabel: string | null
  autoSaveLabel: string | null
  message: string | null
  error: string | null
  onChangeDesignName: (name: string) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

export function ProjectFileControls({
  designName,
  fileName,
  dirty,
  busy,
  operationLabel,
  autoSaveLabel,
  message,
  error,
  onChangeDesignName,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: ProjectFileControlsProps) {
  const [draftName, setDraftName] = useState(designName)

  useEffect(() => {
    setDraftName(designName)
  }, [designName])

  function applyDesignName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onChangeDesignName(draftName)
  }

  return (
    <section className="project-file-controls" aria-labelledby="file-title">
      <div className="project-file-heading">
        <h2 id="file-title">設計ファイル</h2>
        <span className={dirty ? 'is-dirty' : 'is-saved'}>
          {dirty ? '未保存' : '保存済み'}
        </span>
      </div>

      <div className="file-buttons">
        <button type="button" disabled={busy} title="新規設計" onClick={onNew}>
          新規
        </button>
        <button type="button" disabled={busy} title="開く" onClick={onOpen}>
          開く
        </button>
        <button type="button" disabled={busy} title="保存" onClick={onSave}>
          保存
        </button>
        <button
          type="button"
          disabled={busy}
          title="名前を付けて保存"
          onClick={onSaveAs}
        >
          別名保存
        </button>
      </div>

      <details className="project-file-details">
        <summary>設計名とファイル情報</summary>
        <form className="design-name-form" onSubmit={applyDesignName}>
          <label htmlFor="design-name">設計名</label>
          <div>
            <input
              id="design-name"
              type="text"
              value={draftName}
              disabled={busy}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <button type="submit" disabled={busy}>
              反映
            </button>
          </div>
        </form>
        <dl className="file-summary">
          <div>
            <dt>現在のファイル</dt>
            <dd title={fileName}>{fileName}</dd>
          </div>
          <div>
            <dt>保存状態</dt>
            <dd className={dirty ? 'is-dirty' : 'is-saved'}>
              {dirty ? '未保存の変更あり' : '保存済み'}
            </dd>
          </div>
        </dl>
      </details>

      {operationLabel !== null && (
        <p className="file-operation" role="status">
          {operationLabel}
        </p>
      )}
      {autoSaveLabel !== null && (
        <p className="autosave-status" role="status">
          {autoSaveLabel}
        </p>
      )}
      {message !== null && (
        <p className="file-message" role="status">
          {message}
        </p>
      )}
      {error !== null && (
        <p className="file-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
