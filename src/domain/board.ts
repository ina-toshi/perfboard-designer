export type GridPoint = {
  column: number
  row: number
}

export type GridOffset = {
  column: number
  row: number
}

export type Board = {
  columns: number
  rows: number
  pitchMm: 2.54
}

export const DEFAULT_BOARD: Board = {
  columns: 30,
  rows: 20,
  pitchMm: 2.54,
}

export function isGridPointWithinBoard(
  point: GridPoint,
  board: Board,
): boolean {
  return (
    Number.isInteger(point.column) &&
    Number.isInteger(point.row) &&
    point.column >= 0 &&
    point.column < board.columns &&
    point.row >= 0 &&
    point.row < board.rows
  )
}

export function offsetGridPoint(
  point: GridPoint,
  offset: GridOffset,
): GridPoint {
  return {
    column: point.column + offset.column,
    row: point.row + offset.row,
  }
}
