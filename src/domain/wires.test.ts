import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD } from './board'
import {
  WIRE_COLOR_OPTIONS,
  createWire,
  getWireDisplayEmphasis,
  getWireDisplayGridPoints,
  getWireEnd,
  getWireStart,
  isWireWithinBoard,
  isZeroLengthWire,
  withWireColor,
  withWireSide,
} from './wires'

describe('配線モデル', () => {
  it('選択できる配線色に黄色を含める', () => {
    expect(WIRE_COLOR_OPTIONS).toContainEqual({ value: '#facc15', label: '黄' })
  })

  it('表面配線を整数グリッド座標とpoints配列で生成する', () => {
    const wire = createWire(
      'wire-front-1',
      'front',
      { column: 2, row: 3 },
      { column: 8, row: 6 },
    )

    expect(wire).toMatchObject({
      id: 'wire-front-1',
      side: 'front',
      kind: 'jumper',
      color: '#2563eb',
      points: [
        { column: 2, row: 3 },
        { column: 8, row: 6 },
      ],
    })
    expect(wire).not.toHaveProperty('start')
    expect(wire).not.toHaveProperty('end')
    expect(getWireStart(wire)).toEqual({ column: 2, row: 3 })
    expect(getWireEnd(wire)).toEqual({ column: 8, row: 6 })
  })

  it('裏面配線を裏面用の初期色で生成する', () => {
    expect(
      createWire(
        'wire-back-1',
        'back',
        { column: 1, row: 1 },
        { column: 5, row: 1 },
      ),
    ).toMatchObject({
      side: 'back',
      kind: 'solder',
      color: '#d92d20',
    })
  })

  it('裏面にもジャンパー線を生成できる', () => {
    expect(
      createWire(
        'wire-back-jumper-1',
        'back',
        { column: 1, row: 1 },
        { column: 5, row: 1 },
        undefined,
        'jumper',
      ),
    ).toMatchObject({
      side: 'back',
      kind: 'jumper',
      color: '#2563eb',
    })
  })

  it('2つのpointsが基板内か判定する', () => {
    const valid = createWire(
      'wire-1',
      'front',
      { column: 0, row: 0 },
      { column: 29, row: 19 },
    )
    const invalidStart = createWire(
      'wire-2',
      'front',
      { column: -1, row: 0 },
      { column: 4, row: 4 },
    )
    const invalidEnd = createWire(
      'wire-3',
      'back',
      { column: 4, row: 4 },
      { column: 30, row: 19 },
    )
    const invalidPointCount = {
      ...valid,
      points: [...valid.points, { column: 1, row: 1 }],
    }

    expect(isWireWithinBoard(valid, DEFAULT_BOARD)).toBe(true)
    expect(isWireWithinBoard(invalidStart, DEFAULT_BOARD)).toBe(false)
    expect(isWireWithinBoard(invalidEnd, DEFAULT_BOARD)).toBe(false)
    expect(isWireWithinBoard(invalidPointCount, DEFAULT_BOARD)).toBe(false)
  })

  it('始点と終点が同じ長さ0の配線を判定する', () => {
    expect(
      isZeroLengthWire(
        createWire(
          'wire-1',
          'front',
          { column: 4, row: 5 },
          { column: 4, row: 5 },
        ),
      ),
    ).toBe(true)
  })

  it('色と面の変更で座標とユーザー指定色を不用意に変えない', () => {
    const original = createWire(
      'wire-1',
      'front',
      { column: 2, row: 2 },
      { column: 7, row: 8 },
    )
    const recolored = withWireColor(original, '#039855')
    const movedToBack = withWireSide(recolored, 'back')

    expect(movedToBack).toMatchObject({
      side: 'back',
      color: '#039855',
      points: [
        { column: 2, row: 2 },
        { column: 7, row: 8 },
      ],
    })
    expect(original.side).toBe('front')
  })

  it('裏面左右反転後の表示座標だけを変換する', () => {
    const wire = createWire(
      'wire-1',
      'back',
      { column: 2, row: 4 },
      { column: 8, row: 6 },
    )
    const savedPoints = wire.points.map((point) => ({ ...point }))

    expect(getWireDisplayGridPoints(wire, DEFAULT_BOARD, true)).toEqual([
      { column: 27, row: 4 },
      { column: 21, row: 6 },
    ])
    expect(wire.points).toEqual(savedPoints)
    expect(getWireStart(wire)).toEqual({ column: 2, row: 4 })
    expect(getWireEnd(wire)).toEqual({ column: 8, row: 6 })
  })

  it.each([
    ['front', 'front', 'primary'],
    ['back', 'front', 'guide'],
    ['front', 'back', 'guide'],
    ['back', 'back', 'primary'],
    ['front', 'overlay', 'primary'],
    ['back', 'overlay', 'primary'],
  ] as const)('%s配線を%s表示で%sにする', (side, displayMode, expected) => {
    expect(getWireDisplayEmphasis(side, displayMode)).toBe(expected)
  })
})
