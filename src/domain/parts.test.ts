import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD } from './board'
import { getDisplayGridPoint } from './coordinates'
import {
  createConnectorPins,
  createDipPins,
  createPart,
  createPinHeaderPins,
  createTactileSwitchPins,
  generatePartReference,
  getCapacitorPositivePosition,
  getDiodeCathodePosition,
  getPartConductivePinGroups,
  getPartPinPositions,
  isPartWithinBoard,
  withCapacitorPolarity,
  withConnectorPinCount,
  withDipPinCount,
  withLedColor,
  withPartOrigin,
  withPartRotation,
  withPartSettings,
  withPinHeaderConfiguration,
  withPinHeaderGender,
  withPinHeaderNumbering,
  type Part,
  type PartKind,
  type PinHeaderPart,
  type Rotation,
} from './parts'

function requirePartKind<K extends PartKind>(
  part: Part,
  kind: K,
): Extract<Part, { kind: K }> {
  if (part.kind !== kind) {
    throw new Error(`${kind}部品が生成されませんでした。`)
  }
  return part as Extract<Part, { kind: K }>
}

describe('部品モデル', () => {
  it('抵抗の端子間に3穴を空けて生成する', () => {
    const part = createPart('resistor', 'resistor-1', 'R1', {
      column: 4,
      row: 5,
    })

    expect(getPartPinPositions(part)).toEqual([
      { column: 4, row: 5 },
      { column: 8, row: 5 },
    ])
  })

  it('LEDのアノードとカソードを隣接する穴へ生成する', () => {
    const part = createPart('led', 'led-1', 'LED1', {
      column: 2,
      row: 3,
    })

    if (part.kind !== 'led') {
      throw new Error('LED部品が生成されませんでした。')
    }

    expect(part.pins.map((pin) => pin.number)).toEqual(['A', 'K'])
    expect(getPartPinPositions(part)).toEqual([
      { column: 2, row: 3 },
      { column: 3, row: 3 },
    ])
    expect(part).toMatchObject({ color: 'red' })
    expect(withLedColor(part, 'green')).toMatchObject({ color: 'green' })
  })

  it('DIP ICの端子を反時計回りの番号で生成する', () => {
    expect(createDipPins(8)).toEqual([
      { number: '1', offset: { column: 0, row: 0 } },
      { number: '2', offset: { column: 0, row: 1 } },
      { number: '3', offset: { column: 0, row: 2 } },
      { number: '4', offset: { column: 0, row: 3 } },
      { number: '5', offset: { column: 3, row: 3 } },
      { number: '6', offset: { column: 3, row: 2 } },
      { number: '7', offset: { column: 3, row: 1 } },
      { number: '8', offset: { column: 3, row: 0 } },
    ])
  })

  it('ダイオードの端子位置と回転後のカソード位置を計算する', () => {
    const diode = requirePartKind(
      createPart('diode', 'diode-1', 'D1', { column: 10, row: 10 }),
      'diode',
    )
    const rotated = requirePartKind(withPartRotation(diode, 90), 'diode')

    expect(diode.pins.map((pin) => pin.number)).toEqual(['A', 'K'])
    expect(getPartPinPositions(diode)).toEqual([
      { column: 10, row: 10 },
      { column: 13, row: 10 },
    ])
    expect(getPartPinPositions(rotated)).toEqual([
      { column: 10, row: 10 },
      { column: 10, row: 13 },
    ])
    expect(getDiodeCathodePosition(rotated)).toEqual({
      column: 10,
      row: 13,
    })
  })

  it('コンデンサの端子位置と回転後のプラス端子を維持する', () => {
    const capacitor = requirePartKind(
      createPart('capacitor', 'capacitor-1', 'C1', {
        column: 8,
        row: 8,
      }),
      'capacitor',
    )
    const polarized = withCapacitorPolarity(capacitor, true)
    const rotated = requirePartKind(
      withPartRotation(polarized, 270),
      'capacitor',
    )

    expect(polarized.pins.map((pin) => pin.number)).toEqual(['+', '-'])
    expect(polarized.polarized).toBe(true)
    expect(getPartPinPositions(rotated)).toEqual([
      { column: 8, row: 8 },
      { column: 8, row: 7 },
    ])
    expect(getCapacitorPositivePosition(rotated)).toEqual({
      column: 8,
      row: 8,
    })
  })

  it('1列と2列のピンヘッダー端子を一意に生成する', () => {
    expect(createPinHeaderPins(1, 4)).toEqual([
      { number: '1', offset: { column: 0, row: 0 } },
      { number: '2', offset: { column: 0, row: 1 } },
      { number: '3', offset: { column: 0, row: 2 } },
      { number: '4', offset: { column: 0, row: 3 } },
    ])
    expect(createPinHeaderPins(2, 6)).toEqual([
      { number: '1', offset: { column: 0, row: 0 } },
      { number: '2', offset: { column: 1, row: 0 } },
      { number: '3', offset: { column: 0, row: 1 } },
      { number: '4', offset: { column: 1, row: 1 } },
      { number: '5', offset: { column: 0, row: 2 } },
      { number: '6', offset: { column: 1, row: 2 } },
    ])
  })

  it('ピンヘッダーをオスとして作成し、メスへ変更できる', () => {
    const header = requirePartKind(
      createPart('pin-header', 'header-1', 'J1', { column: 0, row: 0 }),
      'pin-header',
    )

    expect(header.gender).toBe('male')
    expect(withPinHeaderGender(header, 'female')).toMatchObject({
      gender: 'female',
      columns: 1,
      pinCount: 4,
    })
  })

  it('ピンヘッダーの端子番号を物理位置を変えずに反転できる', () => {
    const header = requirePartKind(
      withPinHeaderConfiguration(
        createPart('pin-header', 'header-1', 'J1', {
          column: 0,
          row: 0,
        }) as PinHeaderPart,
        { columns: 2, pinCount: 6 },
      ),
      'pin-header',
    )
    const reversed = withPinHeaderNumbering(header, 'reversed')

    expect(reversed.numbering).toBe('reversed')
    expect(reversed.pins).toEqual([
      { number: '6', offset: { column: 0, row: 0 } },
      { number: '5', offset: { column: 1, row: 0 } },
      { number: '4', offset: { column: 0, row: 1 } },
      { number: '3', offset: { column: 1, row: 1 } },
      { number: '2', offset: { column: 0, row: 2 } },
      { number: '1', offset: { column: 1, row: 2 } },
    ])
  })

  it('2列ピンヘッダーの奇数端子を拒否する', () => {
    expect(() => createPinHeaderPins(2, 5)).toThrow(
      '2列ピンヘッダーの端子数は偶数にしてください。',
    )
  })

  it('汎用コネクタの端子を1列に生成する', () => {
    expect(createConnectorPins(3)).toEqual([
      { number: '1', offset: { column: 0, row: 0 } },
      { number: '2', offset: { column: 0, row: 1 } },
      { number: '3', offset: { column: 0, row: 2 } },
    ])
  })

  it('6×6mmタクトSWの端子間に1穴を空けて生成する', () => {
    const part = requirePartKind(
      createPart('tactile-switch', 'switch-1', 'SW1', {
        column: 10,
        row: 10,
      }),
      'tactile-switch',
    )

    expect(createTactileSwitchPins()).toEqual([
      { number: 'A1', offset: { column: 0, row: 0 } },
      { number: 'A2', offset: { column: 2, row: 0 } },
      { number: 'B1', offset: { column: 0, row: 2 } },
      { number: 'B2', offset: { column: 2, row: 2 } },
    ])
    expect(getPartPinPositions(part)).toEqual([
      { column: 10, row: 10 },
      { column: 12, row: 10 },
      { column: 10, row: 12 },
      { column: 12, row: 12 },
    ])
    expect(getPartConductivePinGroups(part)).toEqual([
      ['A1', 'A2'],
      ['B1', 'B2'],
    ])
  })

  it('抵抗の両端子を内部導通グループとして定義する', () => {
    const resistor = createPart('resistor', 'resistor-1', 'R1', {
      column: 10,
      row: 10,
    })

    expect(getPartConductivePinGroups(resistor)).toEqual([['1', '2']])
  })

  it('DIP ICの端子数を変更しても表示名を変更しない', () => {
    const part = requirePartKind(
      createPart('dip', 'dip-1', 'U1', { column: 10, row: 10 }),
      'dip',
    )
    const resized = withDipPinCount(part, 14)

    expect(resized.pinCount).toBe(14)
    expect(resized.pins).toHaveLength(14)
    expect(resized.value).toBe('DIP-8')
  })

  it.each([
    [90, { column: 10, row: 14 }],
    [180, { column: 6, row: 10 }],
    [270, { column: 10, row: 6 }],
  ] satisfies [Rotation, { column: number; row: number }][])(
    '%d度回転後の抵抗端子位置を計算する',
    (rotation, expectedSecondPin) => {
      const part = withPartRotation(
        createPart('resistor', 'resistor-1', 'R1', {
          column: 10,
          row: 10,
        }),
        rotation,
      )

      expect(getPartPinPositions(part)).toEqual([
        { column: 10, row: 10 },
        expectedSecondPin,
      ])
    },
  )

  it('既存LEDとDIP ICの回転後も全端子を穴へ一致させる', () => {
    const led = withPartRotation(
      createPart('led', 'led-1', 'LED1', { column: 5, row: 5 }),
      90,
    )
    const dip = withPartRotation(
      createPart('dip', 'dip-1', 'U1', { column: 10, row: 10 }),
      180,
    )

    expect(getPartPinPositions(led)).toEqual([
      { column: 5, row: 5 },
      { column: 5, row: 6 },
    ])
    expect(getPartPinPositions(dip)).toContainEqual({
      column: 7,
      row: 7,
    })
    expect(
      new Set(getPartPinPositions(dip).map((point) => JSON.stringify(point)))
        .size,
    ).toBe(8)
  })

  it.each([
    ['diode', { column: 28, row: 10 }],
    ['capacitor', { column: 29, row: 10 }],
    ['pin-header', { column: 10, row: 18 }],
    ['connector', { column: 10, row: 19 }],
    ['tactile-switch', { column: 29, row: 19 }],
  ] satisfies [PartKind, { column: number; row: number }][])(
    '%sの基板外配置を判定する',
    (kind, origin) => {
      expect(
        isPartWithinBoard(
          createPart(kind, `${kind}-1`, 'X1', origin),
          DEFAULT_BOARD,
        ),
      ).toBe(false)
    },
  )

  it('部品の全端子が基板内に収まるか判定する', () => {
    const part = createPart('dip', 'dip-1', 'U1', {
      column: 24,
      row: 15,
    })

    expect(isPartWithinBoard(part, DEFAULT_BOARD)).toBe(true)
  })

  it('回転後に基板端からはみ出す配置を不正と判定する', () => {
    const resistor = createPart('resistor', 'resistor-1', 'R1', {
      column: 28,
      row: 19,
    })
    const rotated = withPartRotation(
      withPartOrigin(resistor, { column: 1, row: 0 }),
      180,
    )

    expect(isPartWithinBoard(resistor, DEFAULT_BOARD)).toBe(false)
    expect(isPartWithinBoard(rotated, DEFAULT_BOARD)).toBe(false)
  })

  it('J番号をピンヘッダーと汎用コネクタで共有する', () => {
    const parts: Part[] = [
      createPart('pin-header', 'header-1', 'J1', { column: 0, row: 0 }),
      createPart('connector', 'connector-2', 'J2', {
        column: 2,
        row: 0,
      }),
    ]

    expect(generatePartReference('pin-header', parts)).toBe('J3')
    expect(generatePartReference('connector', parts)).toBe('J3')
  })

  it('部品種類ごとに次の部品番号を生成する', () => {
    const parts: Part[] = [
      createPart('resistor', 'r-1', 'R1', { column: 0, row: 0 }),
      createPart('resistor', 'r-3', 'R3', { column: 0, row: 1 }),
      createPart('led', 'led-1', 'LED1', { column: 0, row: 2 }),
      createPart('dip', 'u-1', 'U1', { column: 0, row: 3 }),
      createPart('diode', 'd-1', 'D1', { column: 0, row: 4 }),
      createPart('capacitor', 'c-1', 'C1', { column: 0, row: 5 }),
      createPart('tactile-switch', 'sw-1', 'SW1', { column: 0, row: 6 }),
    ]

    expect(generatePartReference('resistor', parts)).toBe('R4')
    expect(generatePartReference('led', parts)).toBe('LED2')
    expect(generatePartReference('dip', parts)).toBe('U2')
    expect(generatePartReference('diode', parts)).toBe('D2')
    expect(generatePartReference('capacitor', parts)).toBe('C2')
    expect(generatePartReference('tactile-switch', parts)).toBe('SW2')
  })

  it('別設定を変更してもユーザー指定の部品番号と値を保持する', () => {
    const capacitor = requirePartKind(
      withPartSettings(
        createPart('capacitor', 'capacitor-1', 'C1', {
          column: 0,
          row: 0,
        }),
        { reference: 'C_CUSTOM', value: '47µF' },
      ),
      'capacitor',
    )
    const header = requirePartKind(
      withPartSettings(
        createPart('pin-header', 'header-1', 'J1', {
          column: 2,
          row: 0,
        }),
        { reference: 'J_CUSTOM', value: 'テストヘッダー' },
      ),
      'pin-header',
    )
    const connector = requirePartKind(
      withPartSettings(
        createPart('connector', 'connector-1', 'J2', {
          column: 4,
          row: 0,
        }),
        { reference: 'CN_CUSTOM', value: '電源入力' },
      ),
      'connector',
    )

    expect(withCapacitorPolarity(capacitor, true)).toMatchObject({
      reference: 'C_CUSTOM',
      value: '47µF',
    })
    expect(
      withPinHeaderConfiguration(header, { columns: 2, pinCount: 6 }),
    ).toMatchObject({
      reference: 'J_CUSTOM',
      value: 'テストヘッダー',
    })
    expect(withConnectorPinCount(connector, 4)).toMatchObject({
      reference: 'CN_CUSTOM',
      value: '電源入力',
    })
  })

  it('表示座標を反転しても部品の保存座標を変更しない', () => {
    const part = createPart('led', 'led-1', 'LED1', {
      column: 4,
      row: 7,
    })
    const savedOrigin = { ...part.origin }
    const displayedOrigin = getDisplayGridPoint(
      part.origin,
      DEFAULT_BOARD,
      true,
    )

    expect(displayedOrigin).toEqual({ column: 25, row: 7 })
    expect(part.origin).toEqual(savedOrigin)
  })
})
