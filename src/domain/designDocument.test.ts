import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD } from './board'
import {
  createDesignDocument,
  createEmptyDesignState,
  DESIGN_APPLICATION,
  DESIGN_FORMAT_VERSION,
  parseDesignDocument,
  serializeDesignDocument,
} from './designDocument'
import {
  createPart,
  withCapacitorPolarity,
  withDipPinCount,
  withPinHeaderConfiguration,
  type CapacitorPart,
  type DipPart,
  type PinHeaderPart,
} from './parts'
import { createWire } from './wires'
import type { EditorDesignState } from '../stores/editorStore'

function createSampleDesign(): EditorDesignState {
  return {
    metadata: { name: '電源基板' },
    board: { ...DEFAULT_BOARD },
    parts: [
      createPart('resistor', 'part-1', 'R1', { column: 2, row: 2 }),
      withDipPinCount(
        createPart('dip', 'part-2', 'U1', {
          column: 8,
          row: 3,
        }) as DipPart,
        14,
      ),
      withCapacitorPolarity(
        createPart('capacitor', 'part-3', 'C1', {
          column: 15,
          row: 4,
        }) as CapacitorPart,
        true,
      ),
      withPinHeaderConfiguration(
        createPart('pin-header', 'part-4', 'J1', {
          column: 20,
          row: 4,
        }) as PinHeaderPart,
        { columns: 2, pinCount: 6 },
      ),
      createPart('led', 'part-5', 'LED1', { column: 24, row: 4 }),
    ],
    wires: [
      createWire(
        'wire-1',
        'front',
        { column: 2, row: 2 },
        { column: 8, row: 3 },
      ),
    ],
    nets: [
      { id: 'net-power', name: 'VCC', kind: 'power', color: '#ff0000' },
      { id: 'net-ground', name: 'GND', kind: 'ground' },
    ],
    pinNetAssignments: [
      { partId: 'part-1', pinNumber: '1', netId: 'net-power' },
      { partId: 'part-2', pinNumber: '1', netId: 'net-ground' },
    ],
  }
}

function createValidDocument(): Record<string, unknown> {
  return createDesignDocument(createSampleDesign()) as Record<string, unknown>
}

describe('designDocument', () => {
  it('設計データを読みやすいJSONへ変換し、同じ設計へ復元する', () => {
    const design = createSampleDesign()
    const json = serializeDesignDocument(design)
    const raw = JSON.parse(json) as {
      formatVersion: number
      application: string
      components: Array<Record<string, unknown>>
      wires: Array<Record<string, unknown>>
    }
    const restored = parseDesignDocument(json)

    expect(json.endsWith('\n')).toBe(true)
    expect(json).toContain('\n  "formatVersion": 1,')
    expect(raw.formatVersion).toBe(DESIGN_FORMAT_VERSION)
    expect(raw.application).toBe(DESIGN_APPLICATION)
    expect(raw.components[0].pins).toBeUndefined()
    expect(raw.wires[0]).toMatchObject({ kind: 'jumper' })
    expect(raw.components[4]).toMatchObject({ kind: 'led', color: 'red' })
    expect(restored).toEqual(design)
  })

  it('空の新規設計を形式バージョン1で生成する', () => {
    const document = createDesignDocument(createEmptyDesignState())

    expect(document).toMatchObject({
      formatVersion: 1,
      application: 'perfboard-designer',
      metadata: { name: '名称未設定' },
      board: { columns: 30, rows: 20, pitchMm: 2.54 },
      components: [],
      wires: [],
      nets: [],
      pinNetAssignments: [],
    })
  })

  it('壊れたJSONを拒否する', () => {
    expect(() => parseDesignDocument('{"formatVersion":')).toThrow(
      'JSONの構文が正しくありません。',
    )
  })

  it('application不一致を拒否する', () => {
    const document = createValidDocument()
    document.application = 'other-application'

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(
      'applicationが「perfboard-designer」ではないため開けません。',
    )
  })

  it('未対応formatVersionを明確に拒否する', () => {
    const document = createValidDocument()
    document.formatVersion = 2

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(
      'formatVersion「2」には対応していません。対応バージョンは1です。',
    )
  })

  it.each([
    ['列数', { columns: 0, rows: 20, pitchMm: 2.54 }, 'board.columns'],
    ['行数', { columns: 30, rows: 1.5, pitchMm: 2.54 }, 'board.rows'],
    ['ピッチ', { columns: 30, rows: 20, pitchMm: 1.27 }, 'board.pitchMm'],
  ])('不正な基板%sを拒否する', (_label, board, message) => {
    const document = createValidDocument()
    document.board = board

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(message)
  })

  it('不明な部品種類を拒否する', () => {
    const document = createValidDocument()
    const components = document.components as Array<Record<string, unknown>>
    components[0].kind = 'mystery-part'

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(
      'components[0].kind「mystery-part」には対応していません。',
    )
  })

  it('基板外の部品を拒否する', () => {
    const document = createValidDocument()
    const components = document.components as Array<Record<string, unknown>>
    components[0].origin = { column: 29, row: 19 }

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(
      'components[0]の端子が基板の範囲外にあります。',
    )
  })

  it('不正な配線pointsと基板外座標を拒否する', () => {
    const invalidPoints = createValidDocument()
    const firstWires = invalidPoints.wires as Array<Record<string, unknown>>
    firstWires[0].points = [{ column: 1, row: 1 }]

    expect(() => parseDesignDocument(JSON.stringify(invalidPoints))).toThrow(
      'wires[0].pointsは現在、始点と終点の2点',
    )

    const outside = createValidDocument()
    const secondWires = outside.wires as Array<Record<string, unknown>>
    secondWires[0].points = [
      { column: 1, row: 1 },
      { column: 30, row: 1 },
    ]

    expect(() => parseDesignDocument(JSON.stringify(outside))).toThrow(
      'wires[0]の座標が基板の範囲外にあります。',
    )
  })

  it('配線種類を必須で検証する', () => {
    const missingKind = createValidDocument()
    const missingWire = (missingKind.wires as Array<Record<string, unknown>>)[0]
    delete missingWire.kind

    expect(() => parseDesignDocument(JSON.stringify(missingKind))).toThrow(
      'wires[0].kindは文字列である必要があります。',
    )

    const invalidKind = createValidDocument()
    const invalidWire = (invalidKind.wires as Array<Record<string, unknown>>)[0]
    invalidWire.kind = 'unknown'

    expect(() => parseDesignDocument(JSON.stringify(invalidKind))).toThrow(
      'wires[0].kindはjumperまたはsolderである必要があります。',
    )
  })

  it.each([
    ['ピンヘッダー種別', 3, 'gender', 'components[3].genderはmaleまたはfemale'],
    [
      'ピンヘッダー番号の向き',
      3,
      'numbering',
      'components[3].numberingはnormalまたはreversed',
    ],
    ['LED発光色', 4, 'color', 'components[4].colorは対応しているLEDの発光色'],
  ])('%sを必須で検証する', (_label, index, property, message) => {
    const document = createValidDocument()
    const components = document.components as Array<Record<string, unknown>>
    delete components[index][property]

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(message)
  })

  it('部品と配線をまたぐ重複IDを拒否する', () => {
    const document = createValidDocument()
    const wires = document.wires as Array<Record<string, unknown>>
    wires[0].id = 'part-1'

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(
      'ID「part-1」が部品または配線で重複しています。',
    )
  })

  it.each([
    [
      '重複ネットID',
      (document: Record<string, unknown>) => {
        const nets = document.nets as Array<Record<string, unknown>>
        nets[1].id = nets[0].id
      },
      'ネットID「net-power」が重複しています。',
    ],
    [
      '空白と大文字小文字を除いた重複ネット名',
      (document: Record<string, unknown>) => {
        const nets = document.nets as Array<Record<string, unknown>>
        nets[1].name = ' vCc '
      },
      'ネット名「vCc」が重複しています。',
    ],
    [
      '不正なネット種類',
      (document: Record<string, unknown>) => {
        const nets = document.nets as Array<Record<string, unknown>>
        nets[0].kind = 'unknown'
      },
      'nets[0].kindはsignal、power、ground',
    ],
    [
      '存在しない部品への割り当て',
      (document: Record<string, unknown>) => {
        const assignments = document.pinNetAssignments as Array<
          Record<string, unknown>
        >
        assignments[0].partId = 'missing-part'
      },
      '対応する部品がありません。',
    ],
    [
      '存在しない端子への割り当て',
      (document: Record<string, unknown>) => {
        const assignments = document.pinNetAssignments as Array<
          Record<string, unknown>
        >
        assignments[0].pinNumber = '999'
      },
      '部品「part-1」に存在しません。',
    ],
    [
      '存在しないネットへの割り当て',
      (document: Record<string, unknown>) => {
        const assignments = document.pinNetAssignments as Array<
          Record<string, unknown>
        >
        assignments[0].netId = 'missing-net'
      },
      '対応するネットがありません。',
    ],
    [
      '同じ端子への重複割り当て',
      (document: Record<string, unknown>) => {
        const assignments = document.pinNetAssignments as Array<
          Record<string, unknown>
        >
        assignments.push({
          partId: 'part-1',
          pinNumber: '1',
          netId: 'net-ground',
        })
      },
      '部品「part-1」の端子「1」への割り当てが重複しています。',
    ],
  ])('ネット情報の%sを拒否する', (_label, mutate, message) => {
    const document = createValidDocument()
    mutate(document)

    expect(() => parseDesignDocument(JSON.stringify(document))).toThrow(message)
  })

  it('ネット配列を必須とする', () => {
    const withoutNets = createValidDocument()
    delete withoutNets.nets
    expect(() => parseDesignDocument(JSON.stringify(withoutNets))).toThrow(
      'netsは配列である必要があります。',
    )

    const withoutAssignments = createValidDocument()
    delete withoutAssignments.pinNetAssignments
    expect(() =>
      parseDesignDocument(JSON.stringify(withoutAssignments)),
    ).toThrow('pinNetAssignmentsは配列である必要があります。')
  })

  it('タクトSWの左側と右側へ別ネットを保存して復元する', () => {
    const design = createSampleDesign()
    const tactileSwitch = createPart('tactile-switch', 'switch-1', 'SW1', {
      column: 10,
      row: 10,
    })
    design.parts.push(tactileSwitch)
    design.pinNetAssignments.push(
      ...tactileSwitch.pins.map((pin) => ({
        partId: tactileSwitch.id,
        pinNumber: pin.number,
        netId: pin.number.startsWith('A') ? 'net-power' : 'net-ground',
      })),
    )

    expect(parseDesignDocument(serializeDesignDocument(design))).toEqual(design)
  })

  it('タクトSWの部分的または異なるネットの割り当てを拒否する', () => {
    const design = createSampleDesign()
    const tactileSwitch = createPart('tactile-switch', 'switch-1', 'SW1', {
      column: 10,
      row: 10,
    })
    design.parts.push(tactileSwitch)
    design.pinNetAssignments.push({
      partId: tactileSwitch.id,
      pinNumber: 'A1',
      netId: 'net-power',
    })

    expect(() => parseDesignDocument(serializeDesignDocument(design))).toThrow(
      'タクトSW「SW1」の左側（A1・A2）は2端子とも割り当ててください。',
    )

    design.pinNetAssignments = tactileSwitch.pins.map((pin, index) => ({
      partId: tactileSwitch.id,
      pinNumber: pin.number,
      netId: index === 0 ? 'net-ground' : 'net-power',
    }))

    expect(() => parseDesignDocument(serializeDesignDocument(design))).toThrow(
      'タクトSW「SW1」の左側（A1・A2）には同じネットを割り当ててください。',
    )
  })

  it('形式0のタクトSW端子割り当ては安全のため読み込みを拒否する', () => {
    const design = createSampleDesign()
    const tactileSwitch = createPart('tactile-switch', 'switch-1', 'SW1', {
      column: 10,
      row: 10,
    })
    design.parts.push(tactileSwitch)
    design.pinNetAssignments.push(
      { partId: tactileSwitch.id, pinNumber: 'A1', netId: 'net-power' },
      { partId: tactileSwitch.id, pinNumber: 'A2', netId: 'net-power' },
      { partId: tactileSwitch.id, pinNumber: 'B1', netId: 'net-ground' },
      { partId: tactileSwitch.id, pinNumber: 'B2', netId: 'net-ground' },
    )
    const legacyDocument = JSON.parse(serializeDesignDocument(design)) as {
      formatVersion: number
    }
    legacyDocument.formatVersion = 0

    expect(() => parseDesignDocument(JSON.stringify(legacyDocument))).toThrow(
      'formatVersion 0のタクトSW端子割り当ては自動変換できません。形式1で左側・右側の端子組へ割り当て直してください。',
    )
  })
})
