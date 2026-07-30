import type { Board, GridPoint } from './board'
import { isGridPointWithinBoard } from './board'

export type PartKind =
  | 'resistor'
  | 'led'
  | 'dip'
  | 'diode'
  | 'capacitor'
  | 'pin-header'
  | 'connector'
  | 'tactile-switch'
export type Rotation = 0 | 90 | 180 | 270
export const LED_COLORS = [
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'white',
] as const
export type LedColor = (typeof LED_COLORS)[number]
export const LED_COLOR_LABELS: Record<LedColor, string> = {
  red: '赤',
  green: '緑',
  blue: '青',
  yellow: '黄',
  orange: '橙',
  white: '白',
}
export const LED_COLOR_HEX: Record<LedColor, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#facc15',
  orange: '#f97316',
  white: '#f8fafc',
}
export type PinHeaderColumns = 1 | 2
export const PIN_HEADER_GENDERS = ['male', 'female'] as const
export type PinHeaderGender = (typeof PIN_HEADER_GENDERS)[number]
export const PIN_HEADER_NUMBERINGS = ['normal', 'reversed'] as const
export type PinHeaderNumbering = (typeof PIN_HEADER_NUMBERINGS)[number]

export type PartPin = {
  number: string
  offset: GridPoint
}

type BasePart = {
  id: string
  reference: string
  value: string
  origin: GridPoint
  rotation: Rotation
  pins: PartPin[]
}

export type ResistorPart = BasePart & {
  kind: 'resistor'
}

export type LedPart = BasePart & {
  kind: 'led'
  color: LedColor
}

export type DiodePart = BasePart & {
  kind: 'diode'
}

export type CapacitorPart = BasePart & {
  kind: 'capacitor'
  polarized: boolean
}

export const DIP_PIN_COUNTS = [8, 14, 16, 18, 20, 24, 28, 40] as const
export type DipPinCount = (typeof DIP_PIN_COUNTS)[number]

export type DipPart = BasePart & {
  kind: 'dip'
  pinCount: DipPinCount
}

export const CONFIGURABLE_PIN_COUNTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const
export type ConfigurablePinCount = (typeof CONFIGURABLE_PIN_COUNTS)[number]

export type PinHeaderPart = BasePart & {
  kind: 'pin-header'
  columns: PinHeaderColumns
  pinCount: ConfigurablePinCount
  gender: PinHeaderGender
  numbering: PinHeaderNumbering
}

export type ConnectorPart = BasePart & {
  kind: 'connector'
  pinCount: ConfigurablePinCount
}

export type TactileSwitchPart = BasePart & {
  kind: 'tactile-switch'
}

export const TACTILE_SWITCH_PIN_GROUPS = {
  top: ['A1', 'A2'],
  bottom: ['B1', 'B2'],
} as const
export type TactileSwitchGroup = keyof typeof TACTILE_SWITCH_PIN_GROUPS

export type Part =
  | ResistorPart
  | LedPart
  | DipPart
  | DiodePart
  | CapacitorPart
  | PinHeaderPart
  | ConnectorPart
  | TactileSwitchPart

export type PartDefinition = {
  name: string
  description: string
  referencePrefix: string
  defaultValue: string
}

export const PART_DEFINITIONS: Record<PartKind, PartDefinition> = {
  resistor: {
    name: '抵抗',
    description: '2端子・端子間に3穴',
    referencePrefix: 'R',
    defaultValue: '1kΩ',
  },
  led: {
    name: 'LED',
    description: 'アノード / カソード',
    referencePrefix: 'LED',
    defaultValue: '赤色',
  },
  dip: {
    name: 'DIP IC',
    description: '初期値8端子',
    referencePrefix: 'U',
    defaultValue: 'DIP-8',
  },
  diode: {
    name: 'ダイオード',
    description: '2端子・カソード帯付き',
    referencePrefix: 'D',
    defaultValue: '汎用ダイオード',
  },
  capacitor: {
    name: 'コンデンサ',
    description: '無極性 / 極性あり',
    referencePrefix: 'C',
    defaultValue: '0.1µF',
  },
  'pin-header': {
    name: 'ピンヘッダー',
    description: 'オス / メス・番号反転・1列 / 2列',
    referencePrefix: 'J',
    defaultValue: 'ピンヘッダー',
  },
  connector: {
    name: '汎用コネクタ',
    description: '1列コネクタ',
    referencePrefix: 'J',
    defaultValue: '汎用コネクタ',
  },
  'tactile-switch': {
    name: 'タクトSW',
    description: '6 × 6 mm・4端子・端子間に1穴',
    referencePrefix: 'SW',
    defaultValue: 'タクトSW（4端子）',
  },
}

export const PART_KIND_ORDER: PartKind[] = [
  'resistor',
  'led',
  'dip',
  'diode',
  'capacitor',
  'pin-header',
  'connector',
  'tactile-switch',
]

export function createResistorPins(): PartPin[] {
  return [
    { number: '1', offset: { column: 0, row: 0 } },
    { number: '2', offset: { column: 4, row: 0 } },
  ]
}

export function createLedPins(): PartPin[] {
  return [
    { number: 'A', offset: { column: 0, row: 0 } },
    { number: 'K', offset: { column: 1, row: 0 } },
  ]
}

export function createDiodePins(): PartPin[] {
  return [
    { number: 'A', offset: { column: 0, row: 0 } },
    { number: 'K', offset: { column: 3, row: 0 } },
  ]
}

export function createCapacitorPins(): PartPin[] {
  return [
    { number: '+', offset: { column: 0, row: 0 } },
    { number: '-', offset: { column: 1, row: 0 } },
  ]
}

export function createDipPins(pinCount: DipPinCount): PartPin[] {
  const pinsPerSide = pinCount / 2
  const pins: PartPin[] = []

  for (let index = 0; index < pinsPerSide; index += 1) {
    pins.push({
      number: String(index + 1),
      offset: { column: 0, row: index },
    })
  }

  for (let index = 0; index < pinsPerSide; index += 1) {
    pins.push({
      number: String(pinsPerSide + index + 1),
      offset: { column: 3, row: pinsPerSide - 1 - index },
    })
  }

  return pins
}

function assertConfigurablePinCount(
  pinCount: number,
): asserts pinCount is ConfigurablePinCount {
  if (!CONFIGURABLE_PIN_COUNTS.includes(pinCount as ConfigurablePinCount)) {
    throw new Error('端子数は1から20の範囲で指定してください。')
  }
}

export function createPinHeaderPins(
  columns: PinHeaderColumns,
  pinCount: number,
  numbering: PinHeaderNumbering = 'normal',
): PartPin[] {
  assertConfigurablePinCount(pinCount)

  if (columns === 2 && pinCount % 2 !== 0) {
    throw new Error('2列ピンヘッダーの端子数は偶数にしてください。')
  }

  return Array.from({ length: pinCount }, (_, index) => ({
    number: String(numbering === 'normal' ? index + 1 : pinCount - index),
    offset: {
      column: columns === 1 ? 0 : index % 2,
      row: columns === 1 ? index : Math.floor(index / 2),
    },
  }))
}

export function createConnectorPins(pinCount: number): PartPin[] {
  assertConfigurablePinCount(pinCount)

  return Array.from({ length: pinCount }, (_, index) => ({
    number: String(index + 1),
    offset: { column: 0, row: index },
  }))
}

export function createTactileSwitchPins(): PartPin[] {
  return [
    { number: 'A1', offset: { column: 0, row: 0 } },
    { number: 'A2', offset: { column: 2, row: 0 } },
    { number: 'B1', offset: { column: 0, row: 2 } },
    { number: 'B2', offset: { column: 2, row: 2 } },
  ]
}

export function createPart(
  kind: PartKind,
  id: string,
  reference: string,
  origin: GridPoint,
): Part {
  const definition = PART_DEFINITIONS[kind]
  const base = {
    id,
    reference,
    value: definition.defaultValue,
    origin,
    rotation: 0 as const,
  }

  switch (kind) {
    case 'resistor':
      return { ...base, kind, pins: createResistorPins() }
    case 'led':
      return { ...base, kind, color: 'red', pins: createLedPins() }
    case 'dip':
      return {
        ...base,
        kind,
        pinCount: 8,
        pins: createDipPins(8),
      }
    case 'diode':
      return { ...base, kind, pins: createDiodePins() }
    case 'capacitor':
      return {
        ...base,
        kind,
        polarized: false,
        pins: createCapacitorPins(),
      }
    case 'pin-header':
      return {
        ...base,
        kind,
        columns: 1,
        pinCount: 4,
        gender: 'male',
        numbering: 'normal',
        pins: createPinHeaderPins(1, 4, 'normal'),
      }
    case 'connector':
      return {
        ...base,
        kind,
        pinCount: 2,
        pins: createConnectorPins(2),
      }
    case 'tactile-switch':
      return { ...base, kind, pins: createTactileSwitchPins() }
  }
}

export function getPartConductivePinGroups(part: Part): string[][] {
  switch (part.kind) {
    case 'resistor':
      return [['1', '2']]
    case 'tactile-switch':
      return Object.values(TACTILE_SWITCH_PIN_GROUPS).map((pinNumbers) => [
        ...pinNumbers,
      ])
    case 'led':
    case 'dip':
    case 'diode':
    case 'capacitor':
    case 'pin-header':
    case 'connector':
      return []
  }
}

export function generatePartReference(kind: PartKind, parts: Part[]): string {
  const prefix = PART_DEFINITIONS[kind].referencePrefix
  const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i')
  const highestNumber = parts.reduce((highest, part) => {
    const match = part.reference.match(pattern)
    return match === null ? highest : Math.max(highest, Number(match[1]))
  }, 0)

  return `${prefix}${highestNumber + 1}`
}

export function rotateGridOffset(
  offset: GridPoint,
  rotation: Rotation,
): GridPoint {
  switch (rotation) {
    case 0:
      return offset
    case 90:
      return { column: -offset.row, row: offset.column }
    case 180:
      return { column: -offset.column, row: -offset.row }
    case 270:
      return { column: offset.row, row: -offset.column }
  }
}

export function getPartPinPositions(part: Part): GridPoint[] {
  return part.pins.map((pin) => {
    const offset = rotateGridOffset(pin.offset, part.rotation)
    return {
      column: part.origin.column + offset.column,
      row: part.origin.row + offset.row,
    }
  })
}

function getNamedPinPosition(part: Part, pinNumber: string): GridPoint {
  const pinIndex = part.pins.findIndex((pin) => pin.number === pinNumber)

  if (pinIndex < 0) {
    throw new Error(`端子${pinNumber}が見つかりません。`)
  }

  return getPartPinPositions(part)[pinIndex]
}

export function getDiodeCathodePosition(part: DiodePart): GridPoint {
  return getNamedPinPosition(part, 'K')
}

export function getCapacitorPositivePosition(part: CapacitorPart): GridPoint {
  return getNamedPinPosition(part, '+')
}

export function isPartWithinBoard(part: Part, board: Board): boolean {
  return getPartPinPositions(part).every((point) =>
    isGridPointWithinBoard(point, board),
  )
}

export function getNextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation
}

export function withPartOrigin(part: Part, origin: GridPoint): Part {
  return { ...part, origin }
}

export function withPartRotation(part: Part, rotation: Rotation): Part {
  return { ...part, rotation }
}

export function withPartSettings(
  part: Part,
  settings: { reference: string; value: string },
): Part {
  return { ...part, ...settings }
}

export function withDipPinCount(part: DipPart, pinCount: DipPinCount): DipPart {
  return {
    ...part,
    pinCount,
    pins: createDipPins(pinCount),
  }
}

export function withCapacitorPolarity(
  part: CapacitorPart,
  polarized: boolean,
): CapacitorPart {
  return { ...part, polarized }
}

export function withLedColor(part: LedPart, color: LedColor): LedPart {
  return { ...part, color }
}

export function withPinHeaderConfiguration(
  part: PinHeaderPart,
  configuration: {
    columns: PinHeaderColumns
    pinCount: ConfigurablePinCount
    gender?: PinHeaderGender
    numbering?: PinHeaderNumbering
  },
): PinHeaderPart {
  return {
    ...part,
    ...configuration,
    gender: configuration.gender ?? part.gender,
    numbering: configuration.numbering ?? part.numbering,
    pins: createPinHeaderPins(
      configuration.columns,
      configuration.pinCount,
      configuration.numbering ?? part.numbering,
    ),
  }
}

export function withPinHeaderGender(
  part: PinHeaderPart,
  gender: PinHeaderGender,
): PinHeaderPart {
  return { ...part, gender }
}

export function withPinHeaderNumbering(
  part: PinHeaderPart,
  numbering: PinHeaderNumbering,
): PinHeaderPart {
  return {
    ...part,
    numbering,
    pins: createPinHeaderPins(part.columns, part.pinCount, numbering),
  }
}

export function withConnectorPinCount(
  part: ConnectorPart,
  pinCount: ConfigurablePinCount,
): ConnectorPart {
  return {
    ...part,
    pinCount,
    pins: createConnectorPins(pinCount),
  }
}
