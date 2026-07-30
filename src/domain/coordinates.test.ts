import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOARD,
  isGridPointWithinBoard,
  offsetGridPoint,
  type GridPoint,
} from './board'
import {
  DEFAULT_BOARD_SVG_LAYOUT,
  flipGridPointHorizontally,
  gridPointToSvgPoint,
  nearestHoleFromSvgPoint,
} from './coordinates'
import { DEFAULT_BOARD_VIEW_STATE, withZoom } from './view'

describe('基板座標', () => {
  it('グリッド座標を列と行の差分だけ移動する', () => {
    const point = { column: 8, row: 5 }

    expect(offsetGridPoint(point, { column: -3, row: 4 })).toEqual({
      column: 5,
      row: 9,
    })
    expect(point).toEqual({ column: 8, row: 5 })
  })

  it('グリッド座標をSVG座標へ変換する', () => {
    expect(gridPointToSvgPoint({ column: 3, row: 2 })).toEqual({
      x: 128,
      y: 100,
    })
  })

  it('SVG座標を最も近い基板穴へ吸着する', () => {
    const origin = gridPointToSvgPoint({ column: 12, row: 8 })
    const snapped = nearestHoleFromSvgPoint(
      { x: origin.x + 9, y: origin.y - 7 },
      DEFAULT_BOARD,
    )

    expect(snapped).toEqual({ column: 12, row: 8 })
    expect(
      nearestHoleFromSvgPoint(
        { x: DEFAULT_BOARD_SVG_LAYOUT.gridOrigin.x - 30, y: origin.y },
        DEFAULT_BOARD,
      ),
    ).toBeNull()
  })

  it('基板範囲内かを整数の行・列で判定する', () => {
    expect(isGridPointWithinBoard({ column: 0, row: 0 }, DEFAULT_BOARD)).toBe(
      true,
    )
    expect(isGridPointWithinBoard({ column: 29, row: 19 }, DEFAULT_BOARD)).toBe(
      true,
    )
    expect(isGridPointWithinBoard({ column: 30, row: 19 }, DEFAULT_BOARD)).toBe(
      false,
    )
    expect(isGridPointWithinBoard({ column: 1.5, row: 4 }, DEFAULT_BOARD)).toBe(
      false,
    )
  })

  it('裏面の左右反転は表示用の座標だけを変換する', () => {
    const savedPoint: GridPoint = { column: 4, row: 7 }

    expect(flipGridPointHorizontally(savedPoint, DEFAULT_BOARD)).toEqual({
      column: 25,
      row: 7,
    })
    expect(savedPoint).toEqual({ column: 4, row: 7 })
  })

  it('拡大率を変更しても保存するグリッド座標は変化しない', () => {
    const savedPoint: GridPoint = { column: 10, row: 5 }
    const before = gridPointToSvgPoint(savedPoint)
    const zoomedView = withZoom(DEFAULT_BOARD_VIEW_STATE, 2)

    expect(zoomedView.zoom).toBe(2)
    expect(savedPoint).toEqual({ column: 10, row: 5 })
    expect(gridPointToSvgPoint(savedPoint)).toEqual(before)
  })
})
