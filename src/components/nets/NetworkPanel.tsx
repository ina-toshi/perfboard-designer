import { useEffect, useState } from 'react'
import {
  getNetListItems,
  NET_KIND_LABELS,
} from '../../domain/connectivityPresentation'
import type { ConnectivityAnalysis } from '../../domain/connectivity'
import type { Net, NetKind, PinNetAssignment } from '../../domain/nets'
import './NetworkPanel.css'

type NetSettings = {
  name: string
  kind: NetKind
  color: string
}

type NetworkPanelProps = {
  nets: Net[]
  assignments: PinNetAssignment[]
  analysis: ConnectivityAnalysis
  selectedNetId: string | null
  error: string | null
  onCreate: (settings: NetSettings) => void
  onUpdate: (netId: string, settings: NetSettings) => void
  onDelete: (netId: string) => void
  onSelect: (netId: string) => void
}

const DEFAULT_SETTINGS: NetSettings = {
  name: '',
  kind: 'signal',
  color: '#2563eb',
}

function NetForm({
  title,
  submitLabel,
  initialSettings,
  onSubmit,
}: {
  title: string
  submitLabel: string
  initialSettings: NetSettings
  onSubmit: (settings: NetSettings) => void
}) {
  const [settings, setSettings] = useState(initialSettings)

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  return (
    <form
      className="net-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(settings)
      }}
    >
      <h2>{title}</h2>
      <label>
        ネット名
        <input
          value={settings.name}
          placeholder="例: 3V3"
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
        />
      </label>
      <label>
        種類
        <select
          value={settings.kind}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              kind: event.target.value as NetKind,
            }))
          }
        >
          {(Object.keys(NET_KIND_LABELS) as NetKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {NET_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label>
        色
        <span className="net-color-control">
          <input
            type="color"
            value={settings.color}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                color: event.target.value,
              }))
            }
          />
          <code>{settings.color}</code>
        </span>
      </label>
      <button className="primary-button" type="submit">
        {submitLabel}
      </button>
    </form>
  )
}

export function NetworkPanel({
  nets,
  assignments,
  analysis,
  selectedNetId,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onSelect,
}: NetworkPanelProps) {
  const [pendingDeleteNetId, setPendingDeleteNetId] = useState<string | null>(
    null,
  )
  const items = getNetListItems(nets, assignments, analysis)
  const selectedNet =
    nets.find((candidate) => candidate.id === selectedNetId) ?? null
  const selectedAssignments = assignments.filter(
    (assignment) => assignment.netId === selectedNetId,
  ).length

  useEffect(() => {
    setPendingDeleteNetId(null)
  }, [selectedNetId])

  return (
    <div className="network-panel">
      <NetForm
        title="ネットを作成"
        submitLabel="ネットを追加"
        initialSettings={DEFAULT_SETTINGS}
        onSubmit={onCreate}
      />

      {error !== null && (
        <p className="editor-error net-error" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="net-list-title">
        <h2 id="net-list-title">ネット一覧</h2>
        {items.length === 0 ? (
          <p className="panel-notice">ネットはまだありません。</p>
        ) : (
          <ul className="net-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className={
                    item.id === selectedNetId ? 'is-active' : undefined
                  }
                  type="button"
                  aria-pressed={item.id === selectedNetId}
                  onClick={() => onSelect(item.id)}
                >
                  <span
                    className="net-color-swatch"
                    style={{ backgroundColor: item.color ?? '#98a2b3' }}
                    aria-label={`色 ${item.color ?? '未設定'}`}
                  />
                  <strong>{item.name}</strong>
                  <span>{item.kindLabel}</span>
                  <small>
                    端子{item.assignmentCount}件・接続グループ
                    {item.connectionGroupCount}件
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedNet !== null && (
        <section className="selected-net-editor">
          <NetForm
            title={`${selectedNet.name}を編集`}
            submitLabel="変更を反映"
            initialSettings={{
              name: selectedNet.name,
              kind: selectedNet.kind,
              color: selectedNet.color ?? '#2563eb',
            }}
            onSubmit={(settings) => onUpdate(selectedNet.id, settings)}
          />
          <button
            className="danger-button"
            type="button"
            onClick={() => setPendingDeleteNetId(selectedNet.id)}
          >
            ネットと関連割り当てを削除
          </button>
          {pendingDeleteNetId === selectedNet.id && (
            <div className="net-delete-confirmation" role="alert">
              <strong>{selectedNet.name}を削除しますか？</strong>
              <p>
                関連する端子割り当て{selectedAssignments}
                件も同時に削除されます。
              </p>
              <div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    setPendingDeleteNetId(null)
                    onDelete(selectedNet.id)
                  }}
                >
                  削除する
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteNetId(null)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
