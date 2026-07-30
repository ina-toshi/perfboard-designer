import {
  getInspectionEmptyMessage,
  getIssueListItems,
  getIssuesForNet,
} from '../../domain/connectivityPresentation'
import type { ConnectivityAnalysis } from '../../domain/connectivity'
import type { Net, PinNetAssignment } from '../../domain/nets'
import type { Part } from '../../domain/parts'
import './ConnectivityPanel.css'

type ConnectivityPanelProps = {
  analysis: ConnectivityAnalysis
  nets: Net[]
  assignments: PinNetAssignment[]
  parts: Part[]
  selectedNetId: string | null
  selectedIssueKey: string | null
  onSelectIssue: (issueKey: string) => void
}

function DetailList({ label, values }: { label: string; values: string[] }) {
  return values.length === 0 ? null : (
    <div>
      <dt>{label}</dt>
      <dd>{values.join('、')}</dd>
    </div>
  )
}

export function ConnectivityPanel({
  analysis,
  nets,
  assignments,
  parts,
  selectedNetId,
  selectedIssueKey,
  onSelectIssue,
}: ConnectivityPanelProps) {
  const selectedNet = nets.find((net) => net.id === selectedNetId) ?? null
  const issues = getIssuesForNet(analysis.issues, selectedNetId)
  const items = getIssueListItems(issues, nets, parts)
  const emptyMessage =
    selectedNet === null
      ? getInspectionEmptyMessage(nets, assignments, analysis.issues)
      : `ネット「${selectedNet.name}」に関係する接続上の問題は見つかりませんでした。`

  return (
    <div className="connectivity-panel">
      <section>
        <h2>接続検査結果</h2>
        <p className="inspection-summary">
          {selectedNet === null
            ? '全ネットを対象に、設計変更に合わせて自動更新しています。'
            : `ネット「${selectedNet.name}」を対象に表示しています。`}
          問題を選ぶと基板上の関係箇所を強調します。
        </p>
      </section>

      {items.length === 0 ? (
        <p
          className={
            nets.length > 0 && assignments.length > 0
              ? 'inspection-empty is-success'
              : 'inspection-empty'
          }
          role="status"
        >
          {emptyMessage}
        </p>
      ) : (
        <ol className="issue-list">
          {items.map((item) => (
            <li key={item.key}>
              <button
                className={`issue-card issue-${item.severity}${
                  selectedIssueKey === item.key ? ' is-active' : ''
                }`}
                type="button"
                aria-pressed={selectedIssueKey === item.key}
                onClick={() => onSelectIssue(item.key)}
              >
                <span className="issue-severity">{item.severityLabel}</span>
                <strong>{item.title}</strong>
                <dl>
                  <DetailList label="ネット" values={item.netNames} />
                  <DetailList label="部品端子" values={item.pinLabels} />
                  <DetailList label="基板穴" values={item.holeLabels} />
                  <DetailList label="配線" values={item.wireIds} />
                  <DetailList label="接続グループ" values={item.groupIds} />
                </dl>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
