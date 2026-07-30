import { describe, expect, it } from 'vitest'
import type { Board, GridPoint } from './board'
import {
  analyzeConnectivity,
  getConnectivityHoleKey,
  getConnectivityPinKey,
  type ConnectivityDesign,
} from './connectivity'
import type { Net, PinNetAssignment } from './nets'
import { createPart, type Part } from './parts'
import { createWire, type Wire } from './wires'

const TEST_BOARD: Board = { columns: 8, rows: 8, pitchMm: 2.54 }

function createDesign(
  options: {
    parts?: Part[]
    wires?: Wire[]
    nets?: Net[]
    pinNetAssignments?: PinNetAssignment[]
  } = {},
): ConnectivityDesign {
  return {
    board: TEST_BOARD,
    parts: options.parts ?? [],
    wires: options.wires ?? [],
    nets: options.nets ?? [],
    pinNetAssignments: options.pinNetAssignments ?? [],
  }
}

function holeGroup(design: ConnectivityDesign, point: GridPoint): string {
  return analyzeConnectivity(design).holeGroupIds[getConnectivityHoleKey(point)]
}

describe('analyzeConnectivity', () => {
  it('同じ穴にある複数の部品端子を同じ接続グループにする', () => {
    const first = createPart('resistor', 'part-a', 'R1', {
      column: 1,
      row: 1,
    })
    const second = createPart('led', 'part-b', 'LED1', {
      column: 1,
      row: 1,
    })
    const analysis = analyzeConnectivity(
      createDesign({ parts: [first, second] }),
    )

    expect(
      analysis.pinGroupIds[
        getConnectivityPinKey({ partId: 'part-a', pinNumber: '1' })
      ],
    ).toBe(
      analysis.pinGroupIds[
        getConnectivityPinKey({ partId: 'part-b', pinNumber: 'A' })
      ],
    )
  })

  it('タクトSWの上側と下側の端子を別々の導通グループにする', () => {
    const tactileSwitch = createPart('tactile-switch', 'switch-1', 'SW1', {
      column: 2,
      row: 2,
    })
    const analysis = analyzeConnectivity(
      createDesign({
        parts: [tactileSwitch],
        nets: [{ id: 'signal', name: 'BUTTON', kind: 'signal' }],
        pinNetAssignments: tactileSwitch.pins.map((pin) => ({
          partId: tactileSwitch.id,
          pinNumber: pin.number,
          netId: 'signal',
        })),
      }),
    )
    const groupIds = tactileSwitch.pins.map(
      (pin) =>
        analysis.pinGroupIds[
          getConnectivityPinKey({
            partId: tactileSwitch.id,
            pinNumber: pin.number,
          })
        ],
    )

    expect(groupIds[0]).toBe(groupIds[1])
    expect(groupIds[2]).toBe(groupIds[3])
    expect(groupIds[0]).not.toBe(groupIds[2])
    expect(
      analysis.issues.some(
        (issue) => issue.type === 'unconnected-assigned-pin',
      ),
    ).toBe(false)
  })

  it('配線端点と複数配線を介して穴を連続接続する', () => {
    const design = createDesign({
      wires: [
        createWire(
          'wire-1',
          'front',
          { column: 0, row: 0 },
          { column: 1, row: 0 },
        ),
        createWire(
          'wire-2',
          'front',
          { column: 1, row: 0 },
          { column: 2, row: 0 },
        ),
      ],
    })

    expect(holeGroup(design, { column: 0, row: 0 })).toBe(
      holeGroup(design, { column: 2, row: 0 }),
    )
  })

  it('同じスルーホールを端点とする表面・裏面配線を接続する', () => {
    const design = createDesign({
      wires: [
        createWire(
          'front-wire',
          'front',
          { column: 0, row: 0 },
          { column: 1, row: 0 },
        ),
        createWire(
          'back-wire',
          'back',
          { column: 1, row: 0 },
          { column: 2, row: 0 },
        ),
      ],
    })
    const analysis = analyzeConnectivity(design)

    expect(analysis.wireGroupIds['front-wire']).toBe(
      analysis.wireGroupIds['back-wire'],
    )
  })

  it('画面上で交差しただけの配線を接続しない', () => {
    const analysis = analyzeConnectivity(
      createDesign({
        wires: [
          createWire(
            'wire-a',
            'front',
            { column: 0, row: 0 },
            { column: 2, row: 2 },
          ),
          createWire(
            'wire-b',
            'back',
            { column: 0, row: 2 },
            { column: 2, row: 0 },
          ),
        ],
      }),
    )

    expect(analysis.wireGroupIds['wire-a']).not.toBe(
      analysis.wireGroupIds['wire-b'],
    )
  })

  it('配線途中の穴を端点と接続しない', () => {
    const design = createDesign({
      wires: [
        createWire(
          'wire-1',
          'front',
          { column: 0, row: 0 },
          { column: 2, row: 0 },
        ),
      ],
    })

    expect(holeGroup(design, { column: 1, row: 0 })).not.toBe(
      holeGroup(design, { column: 0, row: 0 }),
    )
  })

  it('抵抗の両端子を同じ接続グループにする', () => {
    const part = createPart('resistor', 'part-1', 'R1', {
      column: 1,
      row: 1,
    })
    const analysis = analyzeConnectivity(createDesign({ parts: [part] }))

    expect(
      analysis.pinGroupIds[
        getConnectivityPinKey({ partId: part.id, pinNumber: '1' })
      ],
    ).toBe(
      analysis.pinGroupIds[
        getConnectivityPinKey({ partId: part.id, pinNumber: '2' })
      ],
    )
  })

  it('ネット競合と電源・GND短絡を場所情報付きで検出する', () => {
    const powerPart = createPart('led', 'power-part', 'LED1', {
      column: 1,
      row: 1,
    })
    const groundPart = createPart('led', 'ground-part', 'LED2', {
      column: 1,
      row: 1,
    })
    const analysis = analyzeConnectivity(
      createDesign({
        parts: [powerPart, groundPart],
        nets: [
          { id: 'power', name: 'VCC', kind: 'power' },
          { id: 'ground', name: 'GND', kind: 'ground' },
        ],
        pinNetAssignments: [
          { partId: powerPart.id, pinNumber: 'A', netId: 'power' },
          { partId: groundPart.id, pinNumber: 'A', netId: 'ground' },
        ],
      }),
    )
    const conflict = analysis.issues.find(
      (issue) => issue.type === 'net-conflict',
    )
    const short = analysis.issues.find(
      (issue) => issue.type === 'power-ground-short',
    )

    expect(conflict).toMatchObject({
      netIds: ['ground', 'power'],
      pins: [
        { partId: 'ground-part', pinNumber: 'A' },
        { partId: 'power-part', pinNumber: 'A' },
      ],
      wireIds: [],
      holes: [{ column: 1, row: 1 }],
    })
    expect(short).toMatchObject({
      netIds: ['ground', 'power'],
      holes: [{ column: 1, row: 1 }],
    })
  })

  it('同一ネットの分断と未接続の割り当て端子を区別して検出する', () => {
    const first = createPart('led', 'part-a', 'LED1', {
      column: 1,
      row: 1,
    })
    const second = createPart('led', 'part-b', 'LED2', {
      column: 4,
      row: 4,
    })
    const analysis = analyzeConnectivity(
      createDesign({
        parts: [first, second],
        nets: [{ id: 'signal', name: 'DATA', kind: 'signal' }],
        pinNetAssignments: [
          { partId: first.id, pinNumber: 'A', netId: 'signal' },
          { partId: second.id, pinNumber: 'A', netId: 'signal' },
        ],
      }),
    )

    expect(
      analysis.issues.filter((issue) => issue.type === 'disconnected-net'),
    ).toHaveLength(1)
    expect(
      analysis.issues.filter(
        (issue) => issue.type === 'unconnected-assigned-pin',
      ),
    ).toHaveLength(2)
  })

  it('同じネットの別端子と同じ穴にある割り当て端子を未接続扱いしない', () => {
    const first = createPart('led', 'part-a', 'LED1', {
      column: 1,
      row: 1,
    })
    const second = createPart('led', 'part-b', 'LED2', {
      column: 1,
      row: 1,
    })
    const analysis = analyzeConnectivity(
      createDesign({
        parts: [first, second],
        nets: [{ id: 'signal', name: 'DATA', kind: 'signal' }],
        pinNetAssignments: [
          { partId: first.id, pinNumber: 'A', netId: 'signal' },
          { partId: second.id, pinNumber: 'A', netId: 'signal' },
        ],
      }),
    )

    expect(
      analysis.issues.some(
        (issue) => issue.type === 'unconnected-assigned-pin',
      ),
    ).toBe(false)
  })

  it('解析結果と問題の順序を入力順に依存せず一定にする', () => {
    const partA = createPart('led', 'part-a', 'LED1', {
      column: 1,
      row: 1,
    })
    const partB = createPart('led', 'part-b', 'LED2', {
      column: 4,
      row: 4,
    })
    const nets: Net[] = [
      { id: 'signal', name: 'DATA', kind: 'signal' },
      { id: 'ground', name: 'GND', kind: 'ground' },
    ]
    const assignments: PinNetAssignment[] = [
      { partId: partA.id, pinNumber: 'A', netId: 'signal' },
      { partId: partB.id, pinNumber: 'A', netId: 'signal' },
      { partId: partA.id, pinNumber: 'K', netId: 'ground' },
    ]
    const first = analyzeConnectivity(
      createDesign({
        parts: [partA, partB],
        nets,
        pinNetAssignments: assignments,
      }),
    )
    const second = analyzeConnectivity(
      createDesign({
        parts: [partB, partA],
        nets: [...nets].reverse(),
        pinNetAssignments: [...assignments].reverse(),
      }),
    )

    expect(second).toEqual(first)
    expect(first.issues.map((issue) => issue.type)).toEqual([
      'disconnected-net',
      'unconnected-assigned-pin',
      'unconnected-assigned-pin',
      'unconnected-assigned-pin',
    ])
  })
})
