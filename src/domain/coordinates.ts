import type { Board, GridPoint } from './board'
import { isGridPointWithinBoard } from './board'

export type SvgPoint = {
  x: number
  y: number
}

export type BoardSvgLayout = {
  gridOrigin: SvgPoint
  holePitch: number
  boardPadding: number
  labelSpace: number
}

export const DEFAULT_BOARD_SVG_LAYOUT: BoardSvgLayout = {
  gridOrigin: { x: 56, y: 52 },
  holePitch: 24,
  boardPadding: 18,
  labelSpace: 34,
}

export function gridPointToSvgPoint(
  point: GridPoint,
  layout: BoardSvgLayout = DEFAULT_BOARD_SVG_LAYOUT,
): SvgPoint {
  return {
    x: layout.gridOrigin.x + point.column * layout.holePitch,
    y: layout.gridOrigin.y + point.row * layout.holePitch,
  }
}

export function snapSvgPointToGrid(
  point: SvgPoint,
  layout: BoardSvgLayout = DEFAULT_BOARD_SVG_LAYOUT,
): GridPoint {
  return {
    column: Math.round((point.x - layout.gridOrigin.x) / layout.holePitch),
    row: Math.round((point.y - layout.gridOrigin.y) / layout.holePitch),
  }
}

export function nearestHoleFromSvgPoint(
  point: SvgPoint,
  board: Board,
  layout: BoardSvgLayout = DEFAULT_BOARD_SVG_LAYOUT,
): GridPoint | null {
  const snappedPoint = snapSvgPointToGrid(point, layout)

  return isGridPointWithinBoard(snappedPoint, board) ? snappedPoint : null
}

export function flipGridPointHorizontally(
  point: GridPoint,
  board: Board,
): GridPoint {
  return {
    column: board.columns - 1 - point.column,
    row: point.row,
  }
}

export function getDisplayGridPoint(
  point: GridPoint,
  board: Board,
  shouldMirrorHorizontally: boolean,
): GridPoint {
  return shouldMirrorHorizontally
    ? flipGridPointHorizontally(point, board)
    : point
}

export function getBoardSvgSize(
  board: Board,
  layout: BoardSvgLayout = DEFAULT_BOARD_SVG_LAYOUT,
): SvgPoint {
  return {
    x:
      layout.gridOrigin.x +
      (board.columns - 1) * layout.holePitch +
      layout.boardPadding * 2,
    y:
      layout.gridOrigin.y +
      (board.rows - 1) * layout.holePitch +
      layout.boardPadding * 2,
  }
}
