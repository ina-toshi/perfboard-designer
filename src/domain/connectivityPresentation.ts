import type { GridPoint } from './board'
import {
  getConnectivityPinKey,
  type ConnectedPin,
  type ConnectivityAnalysis,
  type ConnectivityIssue,
  type ConnectivityIssueType,
} from './connectivity'
import type { Net, NetKind, PinNetAssignment } from './nets'
import { getPartPinPositions, type Part } from './parts'

export const NET_KIND_LABELS: Record<NetKind, string> = {
  signal: '信号',
  power: '電源',
  ground: 'GND',
}

export type IssueSeverity = 'critical' | 'error' | 'warning'

type IssuePresentation = {
  priority: number
  severity: IssueSeverity
  severityLabel: string
  title: string
}

export const ISSUE_PRESENTATIONS: Record<
  ConnectivityIssueType,
  IssuePresentation
> = {
  'power-ground-short': {
    priority: 1,
    severity: 'critical',
    severityLabel: '重大',
    title: '電源とGNDが接続されています',
  },
  'net-conflict': {
    priority: 2,
    severity: 'error',
    severityLabel: 'エラー',
    title: '異なるネット同士が接続されています',
  },
  'disconnected-net': {
    priority: 3,
    severity: 'warning',
    severityLabel: '警告',
    title: '同じネットが複数の接続グループに分断されています',
  },
  'unconnected-assigned-pin': {
    priority: 4,
    severity: 'warning',
    severityLabel: '警告',
    title: 'ネット割り当て済みの端子が接続されていません',
  },
}

export type NetListItem = {
  id: string
  name: string
  kind: NetKind
  kindLabel: string
  color: string | null
  assignmentCount: number
  connectionGroupCount: number
}

export type PartPinRow = {
  partId: string
  partReference: string
  pinNumber: string
  point: GridPoint
  displayColumn: number
  displayRow: number
  netId: string | null
  netName: string | null
}

export type IssueListItem = {
  key: string
  issue: ConnectivityIssue
  severity: IssueSeverity
  severityLabel: string
  title: string
  netNames: string[]
  pinLabels: string[]
  holeLabels: string[]
  wireIds: string[]
  groupIds: string[]
}

export type BoardHighlightTone = IssueSeverity | 'net'

export type BoardHighlight = {
  key: string
  label: string
  tone: BoardHighlightTone
  color?: string
  holes: GridPoint[]
  pins: ConnectedPin[]
  wireIds: string[]
  partIds: string[]
  groupIds: string[]
}

function compareText(first: string, second: string): number {
  return first.localeCompare(second)
}

function comparePoints(first: GridPoint, second: GridPoint): number {
  return first.row - second.row || first.column - second.column
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareText)
}

function uniqueSortedPoints(points: GridPoint[]): GridPoint[] {
  const byKey = new Map(
    points.map((point) => [`${point.column}:${point.row}`, point]),
  )
  return [...byKey.values()].sort(comparePoints)
}

function uniqueSortedPins(pins: ConnectedPin[]): ConnectedPin[] {
  const byKey = new Map(pins.map((pin) => [getConnectivityPinKey(pin), pin]))
  return [...byKey.values()].sort(
    (first, second) =>
      compareText(first.partId, second.partId) ||
      compareText(first.pinNumber, second.pinNumber),
  )
}

export function getNetListItems(
  nets: Net[],
  assignments: PinNetAssignment[],
  analysis: ConnectivityAnalysis,
): NetListItem[] {
  return nets.map((net) => {
    const netAssignments = assignments.filter(
      (assignment) => assignment.netId === net.id,
    )
    const connectionGroupIds = new Set(
      netAssignments
        .map(
          (assignment) =>
            analysis.pinGroupIds[getConnectivityPinKey(assignment)],
        )
        .filter((groupId): groupId is string => groupId !== undefined),
    )

    return {
      id: net.id,
      name: net.name,
      kind: net.kind,
      kindLabel: NET_KIND_LABELS[net.kind],
      color: net.color ?? null,
      assignmentCount: netAssignments.length,
      connectionGroupCount: connectionGroupIds.size,
    }
  })
}

export function getPartPinRows(
  part: Part,
  assignments: PinNetAssignment[],
  nets: Net[],
): PartPinRow[] {
  const positions = getPartPinPositions(part)
  const netsById = new Map(nets.map((net) => [net.id, net]))
  const assignmentsByPin = new Map(
    assignments
      .filter((assignment) => assignment.partId === part.id)
      .map((assignment) => [assignment.pinNumber, assignment]),
  )

  return part.pins.map((pin, index) => {
    const assignment = assignmentsByPin.get(pin.number)
    const net =
      assignment === undefined ? undefined : netsById.get(assignment.netId)
    const point = positions[index]

    return {
      partId: part.id,
      partReference: part.reference,
      pinNumber: pin.number,
      point,
      displayColumn: point.column + 1,
      displayRow: point.row + 1,
      netId: net?.id ?? null,
      netName: net?.name ?? null,
    }
  })
}

export function getConnectivityIssueKey(issue: ConnectivityIssue): string {
  return JSON.stringify([
    issue.type,
    issue.groupIds,
    issue.netIds,
    issue.pins.map((pin) => [pin.partId, pin.pinNumber]),
  ])
}

export function sortConnectivityIssues(
  issues: ConnectivityIssue[],
): ConnectivityIssue[] {
  return [...issues].sort((first, second) => {
    const priorityDifference =
      ISSUE_PRESENTATIONS[first.type].priority -
      ISSUE_PRESENTATIONS[second.type].priority

    return (
      priorityDifference ||
      getConnectivityIssueKey(first).localeCompare(
        getConnectivityIssueKey(second),
      )
    )
  })
}

export function getIssueListItems(
  issues: ConnectivityIssue[],
  nets: Net[],
  parts: Part[],
): IssueListItem[] {
  const netsById = new Map(nets.map((net) => [net.id, net]))
  const partsById = new Map(parts.map((part) => [part.id, part]))

  return sortConnectivityIssues(issues).map((issue) => {
    const presentation = ISSUE_PRESENTATIONS[issue.type]

    return {
      key: getConnectivityIssueKey(issue),
      issue,
      severity: presentation.severity,
      severityLabel: presentation.severityLabel,
      title: presentation.title,
      netNames: issue.netIds.map(
        (netId) => netsById.get(netId)?.name ?? `不明なネット (${netId})`,
      ),
      pinLabels: issue.pins.map((pin) => {
        const reference =
          partsById.get(pin.partId)?.reference ?? `不明な部品 (${pin.partId})`
        return `${reference}・端子${pin.pinNumber}`
      }),
      holeLabels: issue.holes.map(
        (hole) => `列${hole.column + 1}・行${hole.row + 1}`,
      ),
      wireIds: issue.wireIds,
      groupIds: issue.groupIds,
    }
  })
}

export function getIssueHighlight(issue: ConnectivityIssue): BoardHighlight {
  const presentation = ISSUE_PRESENTATIONS[issue.type]

  return {
    key: getConnectivityIssueKey(issue),
    label: presentation.severityLabel,
    tone: presentation.severity,
    holes: uniqueSortedPoints(issue.holes),
    pins: uniqueSortedPins(issue.pins),
    wireIds: uniqueSorted(issue.wireIds),
    partIds: uniqueSorted(issue.pins.map((pin) => pin.partId)),
    groupIds: uniqueSorted(issue.groupIds),
  }
}

export function getIssuesForNet(
  issues: ConnectivityIssue[],
  netId: string | null,
): ConnectivityIssue[] {
  return netId === null
    ? issues
    : issues.filter((issue) => issue.netIds.includes(netId))
}

export function getNetHighlight(
  net: Net,
  assignments: PinNetAssignment[],
  analysis: ConnectivityAnalysis,
): BoardHighlight {
  const selectedAssignments = assignments.filter(
    (assignment) => assignment.netId === net.id,
  )
  const groupIds = uniqueSorted(
    selectedAssignments
      .map(
        (assignment) => analysis.pinGroupIds[getConnectivityPinKey(assignment)],
      )
      .filter((groupId): groupId is string => groupId !== undefined),
  )
  const groups = analysis.groups.filter((group) => groupIds.includes(group.id))
  const selectedPinKeys = new Set(
    selectedAssignments.map(getConnectivityPinKey),
  )
  const pins = uniqueSortedPins(
    groups
      .flatMap((group) => group.pins)
      .filter((pin) => selectedPinKeys.has(getConnectivityPinKey(pin))),
  )
  const conflictingIssue = sortConnectivityIssues(analysis.issues).find(
    (issue) =>
      (issue.type === 'power-ground-short' || issue.type === 'net-conflict') &&
      issue.groupIds.some((groupId) => groupIds.includes(groupId)),
  )
  const presentation =
    conflictingIssue === undefined
      ? null
      : ISSUE_PRESENTATIONS[conflictingIssue.type]

  return {
    key: `net:${net.id}`,
    label: presentation?.severityLabel ?? `ネット: ${net.name}`,
    tone: presentation?.severity ?? 'net',
    ...(presentation === null && net.color !== undefined
      ? { color: net.color }
      : {}),
    holes: uniqueSortedPoints(groups.flatMap((group) => group.holes)),
    pins,
    wireIds: uniqueSorted(groups.flatMap((group) => group.wireIds)),
    partIds: uniqueSorted(pins.map((pin) => pin.partId)),
    groupIds,
  }
}

export function getInspectionEmptyMessage(
  nets: Net[],
  assignments: PinNetAssignment[],
  issues: ConnectivityIssue[],
): string {
  if (nets.length === 0) {
    return 'ネットがまだありません。ネットを作成して端子へ割り当てると接続検査を行えます。'
  }
  if (assignments.length === 0) {
    return '端子へのネット割り当てがまだありません。割り当て後に接続状態を検査します。'
  }
  if (issues.length === 0) {
    return '接続上の問題は見つかりませんでした。'
  }
  return ''
}
