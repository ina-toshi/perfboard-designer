import type { Board, GridPoint } from './board'
import { isGridPointWithinBoard } from './board'
import { getDisplayGridPoint } from './coordinates'
import type { DisplayMode } from './view'

export type WireSide = 'front' | 'back'
export type WireKind = 'jumper' | 'solder'
export type WireDisplayEmphasis = 'primary' | 'guide'

export type Wire = {
  id: string
  side: WireSide
  kind: WireKind
  color: string
  points: GridPoint[]
}

export const DEFAULT_WIRE_COLORS: Record<WireKind, string> = {
  jumper: '#2563eb',
  solder: '#d92d20',
}

export const WIRE_COLOR_OPTIONS = [
  { value: '#2563eb', label: '青' },
  { value: '#d92d20', label: '赤' },
  { value: '#039855', label: '緑' },
  { value: '#facc15', label: '黄' },
  { value: '#dc6803', label: 'オレンジ' },
  { value: '#7f56d9', label: '紫' },
  { value: '#344054', label: '黒' },
] as const

export function areGridPointsEqual(
  first: GridPoint,
  second: GridPoint,
): boolean {
  return first.column === second.column && first.row === second.row
}

export function createWire(
  id: string,
  side: WireSide,
  start: GridPoint,
  end: GridPoint,
  color?: string,
  kind: WireKind = side === 'front' ? 'jumper' : 'solder',
): Wire {
  return {
    id,
    side,
    kind,
    color: color ?? DEFAULT_WIRE_COLORS[kind],
    points: [{ ...start }, { ...end }],
  }
}

export function getWireStart(wire: Wire): GridPoint {
  const start = wire.points[0]

  if (start === undefined) {
    throw new Error('配線に始点がありません。')
  }

  return start
}

export function getWireEnd(wire: Wire): GridPoint {
  const end = wire.points[wire.points.length - 1]

  if (end === undefined) {
    throw new Error('配線に終点がありません。')
  }

  return end
}

export function isWireWithinBoard(wire: Wire, board: Board): boolean {
  return (
    wire.points.length === 2 &&
    wire.points.every((point) => isGridPointWithinBoard(point, board))
  )
}

export function isZeroLengthWire(wire: Wire): boolean {
  return (
    wire.points.length < 2 ||
    areGridPointsEqual(getWireStart(wire), getWireEnd(wire))
  )
}

export function withWireColor(wire: Wire, color: string): Wire {
  return { ...wire, color }
}

export function withWireSide(wire: Wire, side: WireSide): Wire {
  return { ...wire, side, kind: side === 'front' ? 'jumper' : wire.kind }
}

export function withWireKind(wire: Wire, kind: WireKind): Wire {
  return { ...wire, kind, side: kind === 'solder' ? 'back' : wire.side }
}

export function getWireDisplayGridPoints(
  wire: Wire,
  board: Board,
  mirrorHorizontally: boolean,
): GridPoint[] {
  return wire.points.map((point) =>
    getDisplayGridPoint(point, board, mirrorHorizontally),
  )
}

export function getWireDisplayEmphasis(
  side: WireSide,
  displayMode: DisplayMode,
): WireDisplayEmphasis {
  if (displayMode === 'overlay' || side === displayMode) {
    return 'primary'
  }

  return 'guide'
}

export function getWireSideLabel(side: WireSide): string {
  return getWireLabel(side === 'front' ? 'jumper' : 'solder', side)
}

export function getWireLabel(kind: WireKind, side: WireSide): string {
  if (kind === 'solder') {
    return '裏面はんだ配線'
  }

  return side === 'front' ? '表面ジャンパー線' : '裏面ジャンパー線'
}
