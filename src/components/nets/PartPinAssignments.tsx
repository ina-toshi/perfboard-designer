import {
  getPartPinRows,
  type PartPinRow,
} from '../../domain/connectivityPresentation'
import type { Net, PinNetAssignment } from '../../domain/nets'
import {
  TACTILE_SWITCH_PIN_GROUPS,
  type Part,
  type TactileSwitchGroup,
} from '../../domain/parts'
import './NetworkPanel.css'

type PartPinAssignmentsProps = {
  part: Part
  nets: Net[]
  assignments: PinNetAssignment[]
  onAssign: (partId: string, pinNumber: string, netId: string) => void
  onUnassign: (partId: string, pinNumber: string) => void
  onAssignTactileSwitchGroup: (
    partId: string,
    group: TactileSwitchGroup,
    netId: string,
  ) => void
  onUnassignTactileSwitchGroup: (
    partId: string,
    group: TactileSwitchGroup,
  ) => void
}

function TactileSwitchNetAssignment({
  part,
  nets,
  assignments,
  onAssign,
  onUnassign,
}: {
  part: Extract<Part, { kind: 'tactile-switch' }>
  nets: Net[]
  assignments: PinNetAssignment[]
  onAssign: PartPinAssignmentsProps['onAssignTactileSwitchGroup']
  onUnassign: PartPinAssignmentsProps['onUnassignTactileSwitchGroup']
}) {
  return (
    <section className="pin-assignments" aria-labelledby="pin-assignment-title">
      <h2 id="pin-assignment-title">接続ネット</h2>
      {nets.length === 0 && (
        <p className="panel-notice">
          「ネット」タブでネットを作成するとタクトSWへ割り当てられます。
        </p>
      )}
      {(
        Object.entries(TACTILE_SWITCH_PIN_GROUPS) as [
          TactileSwitchGroup,
          readonly string[],
        ][]
      ).map(([group, pinNumbers]) => {
        const groupAssignments = assignments.filter(
          (candidate) =>
            candidate.partId === part.id &&
            pinNumbers.includes(candidate.pinNumber),
        )
        const netId = groupAssignments[0]?.netId ?? ''
        const label = group === 'top' ? '上側（A1 / A2）' : '下側（B1 / B2）'

        return (
          <div key={group} className="tactile-switch-net-assignment">
            <label>
              {label}のネット
              <select
                aria-label={`${part.reference}の${label}ネット`}
                value={netId}
                onChange={(event) => {
                  if (event.target.value === '') {
                    if (netId !== '') {
                      onUnassign(part.id, group)
                    }
                    return
                  }
                  onAssign(part.id, group, event.target.value)
                }}
              >
                <option value="">未割り当て</option>
                {nets.map((net) => (
                  <option key={net.id} value={net.id}>
                    {net.name}
                  </option>
                ))}
              </select>
            </label>
            <p>対象端子: {pinNumbers.join(' / ')}</p>
            <button
              type="button"
              disabled={netId === ''}
              onClick={() => onUnassign(part.id, group)}
            >
              割り当て解除
            </button>
          </div>
        )
      })}
      <p>上側と下側は別々の導通グループとして接続検査します。</p>
    </section>
  )
}

function PinAssignmentRow({
  row,
  nets,
  onAssign,
  onUnassign,
}: {
  row: PartPinRow
  nets: Net[]
  onAssign: PartPinAssignmentsProps['onAssign']
  onUnassign: PartPinAssignmentsProps['onUnassign']
}) {
  return (
    <li className="pin-assignment-row">
      <div>
        <strong>端子{row.pinNumber}</strong>
        <span>
          列{row.displayColumn}・行{row.displayRow}
        </span>
      </div>
      <label>
        ネット
        <select
          aria-label={`${row.partReference} 端子${row.pinNumber}のネット`}
          value={row.netId ?? ''}
          onChange={(event) => {
            if (event.target.value === '') {
              if (row.netId !== null) {
                onUnassign(row.partId, row.pinNumber)
              }
              return
            }
            onAssign(row.partId, row.pinNumber, event.target.value)
          }}
        >
          <option value="">未割り当て</option>
          {nets.map((net) => (
            <option key={net.id} value={net.id}>
              {net.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={row.netId === null}
        onClick={() => onUnassign(row.partId, row.pinNumber)}
      >
        割り当て解除
      </button>
    </li>
  )
}

export function PartPinAssignments({
  part,
  nets,
  assignments,
  onAssign,
  onUnassign,
  onAssignTactileSwitchGroup,
  onUnassignTactileSwitchGroup,
}: PartPinAssignmentsProps) {
  if (part.kind === 'tactile-switch') {
    return (
      <TactileSwitchNetAssignment
        part={part}
        nets={nets}
        assignments={assignments}
        onAssign={onAssignTactileSwitchGroup}
        onUnassign={onUnassignTactileSwitchGroup}
      />
    )
  }

  const rows = getPartPinRows(part, assignments, nets)

  return (
    <section className="pin-assignments" aria-labelledby="pin-assignment-title">
      <h2 id="pin-assignment-title">端子のネット割り当て</h2>
      {nets.length === 0 && (
        <p className="panel-notice">
          「ネット」タブでネットを作成すると端子へ割り当てられます。
        </p>
      )}
      <ul>
        {rows.map((row) => (
          <PinAssignmentRow
            key={row.pinNumber}
            row={row}
            nets={nets}
            onAssign={onAssign}
            onUnassign={onUnassign}
          />
        ))}
      </ul>
    </section>
  )
}
