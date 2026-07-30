import { DEFAULT_BOARD, type Board, type GridPoint } from './board'
import { createDefaultDesignMetadata } from './design'
import {
  getNetNameKey,
  getPinAssignmentKey,
  hasPartPin,
  isNetKind,
  isValidNetColor,
  normalizeNetName,
  type Net,
  type PinNetAssignment,
} from './nets'
import {
  CONFIGURABLE_PIN_COUNTS,
  createPart,
  DIP_PIN_COUNTS,
  LED_COLORS,
  TACTILE_SWITCH_PIN_GROUPS,
  isPartWithinBoard,
  withCapacitorPolarity,
  withConnectorPinCount,
  withDipPinCount,
  withLedColor,
  withPartRotation,
  withPartSettings,
  withPinHeaderConfiguration,
  type ConfigurablePinCount,
  type DipPinCount,
  type LedColor,
  type Part,
  type PartKind,
  type PinHeaderColumns,
  type PinHeaderGender,
  type PinHeaderNumbering,
  type Rotation,
} from './parts'
import {
  createWire,
  isWireWithinBoard,
  isZeroLengthWire,
  type Wire,
  type WireKind,
  type WireSide,
} from './wires'
import type { EditorDesignState } from '../stores/editorStore'

export const DESIGN_APPLICATION = 'perfboard-designer'
export const DESIGN_FORMAT_VERSION = 0

export type DesignDocument = {
  formatVersion: typeof DESIGN_FORMAT_VERSION
  application: typeof DESIGN_APPLICATION
  metadata: {
    name: string
  }
  board: Board
  components: unknown[]
  wires: unknown[]
  nets: unknown[]
  pinNetAssignments: unknown[]
}

export class DesignValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesignValidationError'
  }
}

type JsonObject = Record<string, unknown>

function invalid(message: string): never {
  throw new DesignValidationError(message)
}

function expectObject(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${path}はオブジェクトである必要があります。`)
  }

  return value as JsonObject
}

function expectString(
  value: unknown,
  path: string,
  options: { allowEmpty?: boolean } = {},
): string {
  if (typeof value !== 'string') {
    invalid(`${path}は文字列である必要があります。`)
  }
  if (!options.allowEmpty && value.trim().length === 0) {
    invalid(`${path}を入力してください。`)
  }

  return value
}

function expectPositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    invalid(`${path}は正の整数である必要があります。`)
  }

  return value as number
}

function parseGridPoint(value: unknown, path: string): GridPoint {
  const point = expectObject(value, path)

  if (!Number.isInteger(point.column) || !Number.isInteger(point.row)) {
    invalid(`${path}の列と行は整数である必要があります。`)
  }

  return {
    column: point.column as number,
    row: point.row as number,
  }
}

function parseBoard(value: unknown): Board {
  const board = expectObject(value, 'board')
  const columns = expectPositiveInteger(board.columns, 'board.columns')
  const rows = expectPositiveInteger(board.rows, 'board.rows')

  if (board.pitchMm !== DEFAULT_BOARD.pitchMm) {
    invalid(`board.pitchMmは${DEFAULT_BOARD.pitchMm}である必要があります。`)
  }

  return {
    columns,
    rows,
    pitchMm: DEFAULT_BOARD.pitchMm,
  }
}

function isPartKind(value: string): value is PartKind {
  return [
    'resistor',
    'led',
    'dip',
    'diode',
    'capacitor',
    'pin-header',
    'connector',
    'tactile-switch',
  ].includes(value)
}

function parseRotation(value: unknown, path: string): Rotation {
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) {
    invalid(`${path}は0、90、180、270のいずれかである必要があります。`)
  }

  return value
}

function parsePart(
  value: unknown,
  index: number,
  board: Board,
  ids: Set<string>,
  references: Set<string>,
): Part {
  const path = `components[${index}]`
  const source = expectObject(value, path)
  const id = expectString(source.id, `${path}.id`)
  const kindValue = expectString(source.kind, `${path}.kind`)
  const reference = expectString(source.reference, `${path}.reference`)
  const normalizedReference = reference.toLocaleUpperCase()
  const partValue = expectString(source.value, `${path}.value`, {
    allowEmpty: true,
  })
  const origin = parseGridPoint(source.origin, `${path}.origin`)
  const rotation = parseRotation(source.rotation, `${path}.rotation`)

  if (!isPartKind(kindValue)) {
    invalid(`${path}.kind「${kindValue}」には対応していません。`)
  }
  if (ids.has(id)) {
    invalid(`ID「${id}」が部品または配線で重複しています。`)
  }
  if (references.has(normalizedReference)) {
    invalid(`部品番号「${reference}」が重複しています。`)
  }

  ids.add(id)
  references.add(normalizedReference)

  let part = withPartRotation(
    withPartSettings(createPart(kindValue, id, reference, origin), {
      reference,
      value: partValue,
    }),
    rotation,
  )

  switch (part.kind) {
    case 'dip': {
      if (
        typeof source.pinCount !== 'number' ||
        !DIP_PIN_COUNTS.includes(source.pinCount as DipPinCount)
      ) {
        invalid(`${path}.pinCountは対応しているDIP端子数ではありません。`)
      }
      part = withDipPinCount(part, source.pinCount as DipPinCount)
      break
    }
    case 'capacitor': {
      if (typeof source.polarized !== 'boolean') {
        invalid(`${path}.polarizedは真偽値である必要があります。`)
      }
      part = withCapacitorPolarity(part, source.polarized)
      break
    }
    case 'pin-header': {
      if (source.columns !== 1 && source.columns !== 2) {
        invalid(`${path}.columnsは1または2である必要があります。`)
      }
      if (
        typeof source.pinCount !== 'number' ||
        !CONFIGURABLE_PIN_COUNTS.includes(
          source.pinCount as ConfigurablePinCount,
        )
      ) {
        invalid(`${path}.pinCountは1から20の整数である必要があります。`)
      }
      if (source.columns === 2 && source.pinCount % 2 !== 0) {
        invalid(`${path}の2列ピンヘッダーの端子数は偶数にしてください。`)
      }
      if (source.gender !== 'male' && source.gender !== 'female') {
        invalid(`${path}.genderはmaleまたはfemaleである必要があります。`)
      }
      if (source.numbering !== 'normal' && source.numbering !== 'reversed') {
        invalid(`${path}.numberingはnormalまたはreversedである必要があります。`)
      }
      part = withPinHeaderConfiguration(part, {
        columns: source.columns as PinHeaderColumns,
        pinCount: source.pinCount as ConfigurablePinCount,
        gender: source.gender as PinHeaderGender,
        numbering: source.numbering as PinHeaderNumbering,
      })
      break
    }
    case 'connector': {
      if (
        typeof source.pinCount !== 'number' ||
        !CONFIGURABLE_PIN_COUNTS.includes(
          source.pinCount as ConfigurablePinCount,
        )
      ) {
        invalid(`${path}.pinCountは1から20の整数である必要があります。`)
      }
      part = withConnectorPinCount(
        part,
        source.pinCount as ConfigurablePinCount,
      )
      break
    }
    case 'led': {
      if (!LED_COLORS.includes(source.color as LedColor)) {
        invalid(`${path}.colorは対応しているLEDの発光色である必要があります。`)
      }
      part = withLedColor(part, source.color as LedColor)
      break
    }
    case 'tactile-switch':
      break
    case 'resistor':
    case 'diode':
      break
  }

  if (!isPartWithinBoard(part, board)) {
    invalid(`${path}の端子が基板の範囲外にあります。`)
  }

  return part
}

function parseWire(
  value: unknown,
  index: number,
  board: Board,
  ids: Set<string>,
): Wire {
  const path = `wires[${index}]`
  const source = expectObject(value, path)
  const id = expectString(source.id, `${path}.id`)
  const color = expectString(source.color, `${path}.color`)

  if (ids.has(id)) {
    invalid(`ID「${id}」が部品または配線で重複しています。`)
  }
  if (source.side !== 'front' && source.side !== 'back') {
    invalid(`${path}.sideはfrontまたはbackである必要があります。`)
  }
  const kind = expectString(source.kind, `${path}.kind`)
  if (kind !== 'jumper' && kind !== 'solder') {
    invalid(`${path}.kindはjumperまたはsolderである必要があります。`)
  }
  if (kind === 'solder' && source.side !== 'back') {
    invalid(`${path}.sideがfrontのとき、はんだ配線にはできません。`)
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    invalid(`${path}.colorは#から始まる6桁の色コードにしてください。`)
  }
  if (!Array.isArray(source.points) || source.points.length !== 2) {
    invalid(`${path}.pointsは現在、始点と終点の2点である必要があります。`)
  }

  const points = source.points.map((point, pointIndex) =>
    parseGridPoint(point, `${path}.points[${pointIndex}]`),
  )
  const wire = createWire(
    id,
    source.side as WireSide,
    points[0],
    points[1],
    color,
    kind as WireKind,
  )

  if (isZeroLengthWire(wire)) {
    invalid(`${path}の始点と終点を同じ穴にはできません。`)
  }
  if (!isWireWithinBoard(wire, board)) {
    invalid(`${path}の座標が基板の範囲外にあります。`)
  }

  ids.add(id)
  return wire
}

function parseNet(
  value: unknown,
  index: number,
  ids: Set<string>,
  names: Set<string>,
): Net {
  const path = `nets[${index}]`
  const source = expectObject(value, path)
  const id = expectString(source.id, `${path}.id`)
  const name = normalizeNetName(expectString(source.name, `${path}.name`))
  const nameKey = getNetNameKey(name)

  if (ids.has(id)) {
    invalid(`ネットID「${id}」が重複しています。`)
  }
  if (names.has(nameKey)) {
    invalid(`ネット名「${name}」が重複しています。`)
  }
  if (!isNetKind(source.kind)) {
    invalid(
      `${path}.kindはsignal、power、groundのいずれかである必要があります。`,
    )
  }
  if (
    source.color !== undefined &&
    (typeof source.color !== 'string' || !isValidNetColor(source.color))
  ) {
    invalid(`${path}.colorは#から始まる6桁の色コードにしてください。`)
  }

  ids.add(id)
  names.add(nameKey)

  return {
    id,
    name,
    kind: source.kind,
    ...(source.color === undefined ? {} : { color: source.color }),
  }
}

function parsePinNetAssignment(
  value: unknown,
  index: number,
  partsById: Map<string, Part>,
  netIds: Set<string>,
  assignmentKeys: Set<string>,
): PinNetAssignment {
  const path = `pinNetAssignments[${index}]`
  const source = expectObject(value, path)
  const partId = expectString(source.partId, `${path}.partId`)
  const pinNumber = expectString(source.pinNumber, `${path}.pinNumber`)
  const netId = expectString(source.netId, `${path}.netId`)
  const part = partsById.get(partId)

  if (part === undefined) {
    invalid(`${path}.partId「${partId}」に対応する部品がありません。`)
  }
  if (!hasPartPin(part, pinNumber)) {
    invalid(
      `${path}.pinNumber「${pinNumber}」は部品「${partId}」に存在しません。`,
    )
  }
  if (!netIds.has(netId)) {
    invalid(`${path}.netId「${netId}」に対応するネットがありません。`)
  }

  const assignment: PinNetAssignment = { partId, pinNumber, netId }
  const key = getPinAssignmentKey(assignment)

  if (assignmentKeys.has(key)) {
    invalid(
      `部品「${partId}」の端子「${pinNumber}」への割り当てが重複しています。`,
    )
  }

  assignmentKeys.add(key)
  return assignment
}

function validateTactileSwitchAssignments(
  parts: Part[],
  assignments: PinNetAssignment[],
): void {
  for (const part of parts) {
    if (part.kind !== 'tactile-switch') {
      continue
    }

    const partAssignments = assignments.filter(
      (assignment) => assignment.partId === part.id,
    )

    if (partAssignments.length === 0) {
      continue
    }

    const tactileGroups: Array<{
      label: string
      pinNumbers: readonly string[]
    }> = [
      { label: '上側（A1・A2）', pinNumbers: TACTILE_SWITCH_PIN_GROUPS.top },
      {
        label: '下側（B1・B2）',
        pinNumbers: TACTILE_SWITCH_PIN_GROUPS.bottom,
      },
    ]

    for (const { label: groupLabel, pinNumbers } of tactileGroups) {
      const groupAssignments = partAssignments.filter((assignment) =>
        pinNumbers.includes(assignment.pinNumber),
      )

      if (groupAssignments.length === 0) {
        continue
      }

      const assignedPinNumbers = new Set(
        groupAssignments.map((assignment) => assignment.pinNumber),
      )
      const netIds = new Set(
        groupAssignments.map((assignment) => assignment.netId),
      )
      if (
        assignedPinNumbers.size !== pinNumbers.length ||
        !pinNumbers.every((pinNumber) => assignedPinNumbers.has(pinNumber))
      ) {
        invalid(
          `タクトSW「${part.reference}」の${groupLabel}は2端子とも割り当ててください。`,
        )
      }
      if (netIds.size !== 1) {
        invalid(
          `タクトSW「${part.reference}」の${groupLabel}には同じネットを割り当ててください。`,
        )
      }
    }
  }
}

function serializePart(part: Part): JsonObject {
  const base: JsonObject = {
    id: part.id,
    kind: part.kind,
    reference: part.reference,
    value: part.value,
    origin: { ...part.origin },
    rotation: part.rotation,
  }

  switch (part.kind) {
    case 'dip':
      return { ...base, pinCount: part.pinCount }
    case 'capacitor':
      return { ...base, polarized: part.polarized }
    case 'pin-header':
      return {
        ...base,
        columns: part.columns,
        pinCount: part.pinCount,
        gender: part.gender,
        numbering: part.numbering,
      }
    case 'connector':
      return { ...base, pinCount: part.pinCount }
    case 'led':
      return { ...base, color: part.color }
    case 'tactile-switch':
    case 'resistor':
    case 'diode':
      return base
  }
}

export function createEmptyDesignState(): EditorDesignState {
  return {
    metadata: createDefaultDesignMetadata(),
    board: { ...DEFAULT_BOARD },
    parts: [],
    wires: [],
    nets: [],
    pinNetAssignments: [],
  }
}

export function createDesignDocument(
  design: EditorDesignState,
): DesignDocument {
  return {
    formatVersion: DESIGN_FORMAT_VERSION,
    application: DESIGN_APPLICATION,
    metadata: { ...design.metadata },
    board: { ...design.board },
    components: design.parts.map(serializePart),
    wires: design.wires.map((wire) => ({
      id: wire.id,
      side: wire.side,
      kind: wire.kind,
      color: wire.color,
      points: wire.points.map((point) => ({ ...point })),
    })),
    nets: design.nets.map((net) => ({ ...net })),
    pinNetAssignments: design.pinNetAssignments.map((assignment) => ({
      ...assignment,
    })),
  }
}

export function serializeDesignDocument(design: EditorDesignState): string {
  return `${JSON.stringify(createDesignDocument(design), null, 2)}\n`
}

export function getDesignFingerprint(design: EditorDesignState): string {
  return JSON.stringify(createDesignDocument(design))
}

export function parseDesignDocumentValue(value: unknown): EditorDesignState {
  const document = expectObject(value, '設計ファイル')

  if (document.application !== DESIGN_APPLICATION) {
    invalid(`applicationが「${DESIGN_APPLICATION}」ではないため開けません。`)
  }
  if (document.formatVersion !== DESIGN_FORMAT_VERSION) {
    invalid(
      `formatVersion「${String(document.formatVersion)}」には対応していません。対応バージョンは${DESIGN_FORMAT_VERSION}です。`,
    )
  }

  const metadataSource = expectObject(document.metadata, 'metadata')
  const name = expectString(metadataSource.name, 'metadata.name').trim()
  const board = parseBoard(document.board)

  if (!Array.isArray(document.components)) {
    invalid('componentsは配列である必要があります。')
  }
  if (!Array.isArray(document.wires)) {
    invalid('wiresは配列である必要があります。')
  }
  if (!Array.isArray(document.nets)) {
    invalid('netsは配列である必要があります。')
  }
  if (!Array.isArray(document.pinNetAssignments)) {
    invalid('pinNetAssignmentsは配列である必要があります。')
  }

  const ids = new Set<string>()
  const references = new Set<string>()
  const parts = document.components.map((part, index) =>
    parsePart(part, index, board, ids, references),
  )
  const wires = document.wires.map((wire, index) =>
    parseWire(wire, index, board, ids),
  )
  const netIds = new Set<string>()
  const netNames = new Set<string>()
  const nets = (document.nets as unknown[]).map((net, index) =>
    parseNet(net, index, netIds, netNames),
  )
  const partsById = new Map(parts.map((part) => [part.id, part]))
  const assignmentKeys = new Set<string>()
  const pinNetAssignments = (document.pinNetAssignments as unknown[]).map(
    (assignment, index) =>
      parsePinNetAssignment(
        assignment,
        index,
        partsById,
        netIds,
        assignmentKeys,
      ),
  )

  validateTactileSwitchAssignments(parts, pinNetAssignments)

  return {
    metadata: { name },
    board,
    parts,
    wires,
    nets,
    pinNetAssignments,
  }
}

export function parseDesignDocument(json: string): EditorDesignState {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    invalid('JSONの構文が正しくありません。')
  }

  return parseDesignDocumentValue(value)
}
