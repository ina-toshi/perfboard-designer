import type { Board, GridPoint } from './board'
import type { Net, PinNetAssignment } from './nets'
import {
  getPartConductivePinGroups,
  getPartPinPositions,
  type Part,
} from './parts'
import { getWireEnd, getWireStart, type Wire } from './wires'

export type ConnectedPin = {
  partId: string
  pinNumber: string
  hole: GridPoint
}

export type ConnectionGroup = {
  id: string
  holes: GridPoint[]
  pins: ConnectedPin[]
  wireIds: string[]
  netIds: string[]
}

export type ConnectivityIssueType =
  | 'net-conflict'
  | 'disconnected-net'
  | 'unconnected-assigned-pin'
  | 'power-ground-short'

export type ConnectivityIssue = {
  type: ConnectivityIssueType
  groupIds: string[]
  netIds: string[]
  pins: ConnectedPin[]
  wireIds: string[]
  holes: GridPoint[]
}

export type ConnectivityAnalysis = {
  groups: ConnectionGroup[]
  holeGroupIds: Record<string, string>
  pinGroupIds: Record<string, string>
  wireGroupIds: Record<string, string>
  issues: ConnectivityIssue[]
}

export type ConnectivityDesign = {
  board: Board
  parts: Part[]
  wires: Wire[]
  nets: Net[]
  pinNetAssignments: PinNetAssignment[]
}

class UnionFind {
  private readonly parents = new Map<string, string>()

  add(value: string): void {
    if (!this.parents.has(value)) {
      this.parents.set(value, value)
    }
  }

  find(value: string): string {
    const parent = this.parents.get(value)

    if (parent === undefined) {
      this.add(value)
      return value
    }
    if (parent === value) {
      return value
    }

    const root = this.find(parent)
    this.parents.set(value, root)
    return root
  }

  union(first: string, second: string): void {
    const firstRoot = this.find(first)
    const secondRoot = this.find(second)

    if (firstRoot !== secondRoot) {
      this.parents.set(secondRoot, firstRoot)
    }
  }
}

export function getConnectivityHoleKey(point: GridPoint): string {
  return JSON.stringify([point.column, point.row])
}

export function getConnectivityPinKey(
  pin: Pick<ConnectedPin, 'partId' | 'pinNumber'>,
): string {
  return JSON.stringify([pin.partId, pin.pinNumber])
}

function comparePoints(first: GridPoint, second: GridPoint): number {
  return first.row - second.row || first.column - second.column
}

function comparePins(first: ConnectedPin, second: ConnectedPin): number {
  return (
    first.partId.localeCompare(second.partId) ||
    first.pinNumber.localeCompare(second.pinNumber) ||
    comparePoints(first.hole, second.hole)
  )
}

function collectIssueContext(
  groupIds: string[],
  groupsById: Map<string, ConnectionGroup>,
): Pick<ConnectivityIssue, 'pins' | 'wireIds' | 'holes'> {
  const groups = groupIds
    .map((groupId) => groupsById.get(groupId))
    .filter((group): group is ConnectionGroup => group !== undefined)

  return {
    pins: groups.flatMap((group) => group.pins).sort(comparePins),
    wireIds: [...new Set(groups.flatMap((group) => group.wireIds))].sort(
      (first, second) => first.localeCompare(second),
    ),
    holes: groups.flatMap((group) => group.holes).sort(comparePoints),
  }
}

export function analyzeConnectivity(
  design: ConnectivityDesign,
): ConnectivityAnalysis {
  const unionFind = new UnionFind()
  const holes: GridPoint[] = []

  for (let row = 0; row < design.board.rows; row += 1) {
    for (let column = 0; column < design.board.columns; column += 1) {
      const hole = { column, row }
      holes.push(hole)
      unionFind.add(getConnectivityHoleKey(hole))
    }
  }

  // 折れ線の中間点は描画上の曲げ点であり、電気的な接続点ではない。
  // Phase 1では従来どおり、配線の始点と終点だけを導通させる。
  for (const wire of design.wires) {
    unionFind.union(
      getConnectivityHoleKey(getWireStart(wire)),
      getConnectivityHoleKey(getWireEnd(wire)),
    )
  }

  for (const part of design.parts) {
    const pinPositions = getPartPinPositions(part)
    const positionsByPinNumber = new Map(
      part.pins.map((pin, index) => [pin.number, pinPositions[index]]),
    )

    for (const pinNumbers of getPartConductivePinGroups(part)) {
      const firstPosition = positionsByPinNumber.get(pinNumbers[0])

      if (firstPosition === undefined) {
        continue
      }
      for (const pinNumber of pinNumbers.slice(1)) {
        const position = positionsByPinNumber.get(pinNumber)

        if (position !== undefined) {
          unionFind.union(
            getConnectivityHoleKey(firstPosition),
            getConnectivityHoleKey(position),
          )
        }
      }
    }
  }

  const holesByRoot = new Map<string, GridPoint[]>()

  for (const hole of holes) {
    const root = unionFind.find(getConnectivityHoleKey(hole))
    holesByRoot.set(root, [...(holesByRoot.get(root) ?? []), hole])
  }

  const sortedHoleGroups = [...holesByRoot.values()]
    .map((groupHoles) => groupHoles.sort(comparePoints))
    .sort((first, second) => comparePoints(first[0], second[0]))
  const groups = sortedHoleGroups.map<ConnectionGroup>((groupHoles, index) => ({
    id: `group-${index + 1}`,
    holes: groupHoles,
    pins: [],
    wireIds: [],
    netIds: [],
  }))
  const holeGroupIds: Record<string, string> = {}
  const groupsById = new Map(groups.map((group) => [group.id, group]))

  for (const group of groups) {
    for (const hole of group.holes) {
      holeGroupIds[getConnectivityHoleKey(hole)] = group.id
    }
  }

  const pinGroupIds: Record<string, string> = {}

  for (const part of [...design.parts].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const positions = getPartPinPositions(part)

    part.pins.forEach((pin, index) => {
      const connectedPin: ConnectedPin = {
        partId: part.id,
        pinNumber: pin.number,
        hole: positions[index],
      }
      const groupId = holeGroupIds[getConnectivityHoleKey(connectedPin.hole)]

      if (groupId !== undefined) {
        pinGroupIds[getConnectivityPinKey(connectedPin)] = groupId
        groupsById.get(groupId)?.pins.push(connectedPin)
      }
    })
  }

  const wireGroupIds: Record<string, string> = {}

  for (const wire of [...design.wires].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const groupId = holeGroupIds[getConnectivityHoleKey(getWireStart(wire))]

    if (groupId !== undefined) {
      wireGroupIds[wire.id] = groupId
      groupsById.get(groupId)?.wireIds.push(wire.id)
    }
  }

  const assignmentsByPin = new Map(
    design.pinNetAssignments.map((assignment) => [
      getConnectivityPinKey(assignment),
      assignment,
    ]),
  )
  const groupIdsByNet = new Map<string, Set<string>>()

  for (const group of groups) {
    group.pins.sort(comparePins)
    group.wireIds.sort((first, second) => first.localeCompare(second))

    const netIds = new Set<string>()

    for (const pin of group.pins) {
      const assignment = assignmentsByPin.get(getConnectivityPinKey(pin))

      if (assignment !== undefined) {
        netIds.add(assignment.netId)
        const netGroups = groupIdsByNet.get(assignment.netId) ?? new Set()
        netGroups.add(group.id)
        groupIdsByNet.set(assignment.netId, netGroups)
      }
    }

    group.netIds = [...netIds].sort((first, second) =>
      first.localeCompare(second),
    )
  }

  const issues: ConnectivityIssue[] = []
  const netsById = new Map(design.nets.map((net) => [net.id, net]))

  for (const group of groups) {
    if (group.netIds.length > 1) {
      issues.push({
        type: 'net-conflict',
        groupIds: [group.id],
        netIds: group.netIds,
        ...collectIssueContext([group.id], groupsById),
      })
    }
  }

  for (const net of [...design.nets].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const groupIds = [...(groupIdsByNet.get(net.id) ?? [])].sort(
      (first, second) => first.localeCompare(second),
    )

    if (groupIds.length > 1) {
      issues.push({
        type: 'disconnected-net',
        groupIds,
        netIds: [net.id],
        ...collectIssueContext(groupIds, groupsById),
      })
    }
  }

  for (const assignment of [...design.pinNetAssignments].sort(
    (first, second) =>
      first.partId.localeCompare(second.partId) ||
      first.pinNumber.localeCompare(second.pinNumber) ||
      first.netId.localeCompare(second.netId),
  )) {
    const pinKey = getConnectivityPinKey(assignment)
    const groupId = pinGroupIds[pinKey]
    const group = groupsById.get(groupId)

    if (group === undefined || group.wireIds.length > 0) {
      continue
    }

    const sameNetPins = group.pins.filter(
      (pin) =>
        assignmentsByPin.get(getConnectivityPinKey(pin))?.netId ===
        assignment.netId,
    )

    if (sameNetPins.length === 1) {
      issues.push({
        type: 'unconnected-assigned-pin',
        groupIds: [group.id],
        netIds: [assignment.netId],
        pins: sameNetPins,
        wireIds: [],
        holes: [sameNetPins[0].hole],
      })
    }
  }

  for (const group of groups) {
    const kinds = new Set(
      group.netIds.map((netId) => netsById.get(netId)?.kind),
    )

    if (kinds.has('power') && kinds.has('ground')) {
      issues.push({
        type: 'power-ground-short',
        groupIds: [group.id],
        netIds: group.netIds,
        ...collectIssueContext([group.id], groupsById),
      })
    }
  }

  return {
    groups,
    holeGroupIds,
    pinGroupIds,
    wireGroupIds,
    issues,
  }
}
