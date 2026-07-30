import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD } from './board'
import { analyzeConnectivity, type ConnectivityIssue } from './connectivity'
import {
  getInspectionEmptyMessage,
  getIssueHighlight,
  getIssueListItems,
  getIssuesForNet,
  getNetHighlight,
  getNetListItems,
  getPartPinRows,
  NET_KIND_LABELS,
  sortConnectivityIssues,
} from './connectivityPresentation'
import type { Net, PinNetAssignment } from './nets'
import { createPart, withPartRotation } from './parts'
import { createWire } from './wires'

describe('connectivityPresentation', () => {
  it('ネット一覧へ日本語種類、色、割り当て端子数、接続グループ数を集計する', () => {
    const first = createPart('led', 'part-a', 'LED1', {
      column: 1,
      row: 1,
    })
    const second = createPart('led', 'part-b', 'LED2', {
      column: 4,
      row: 1,
    })
    const nets: Net[] = [
      { id: 'signal', name: 'SPI_MOSI', kind: 'signal', color: '#2563eb' },
      { id: 'power', name: '3V3', kind: 'power' },
      { id: 'ground', name: 'GND', kind: 'ground' },
    ]
    const assignments: PinNetAssignment[] = [
      { partId: first.id, pinNumber: 'A', netId: 'signal' },
      { partId: second.id, pinNumber: 'A', netId: 'signal' },
    ]
    const analysis = analyzeConnectivity({
      board: DEFAULT_BOARD,
      parts: [first, second],
      wires: [],
      nets,
      pinNetAssignments: assignments,
    })

    expect(NET_KIND_LABELS).toEqual({
      signal: '信号',
      power: '電源',
      ground: 'GND',
    })
    expect(getNetListItems(nets, assignments, analysis)).toEqual([
      {
        id: 'signal',
        name: 'SPI_MOSI',
        kind: 'signal',
        kindLabel: '信号',
        color: '#2563eb',
        assignmentCount: 2,
        connectionGroupCount: 2,
      },
      {
        id: 'power',
        name: '3V3',
        kind: 'power',
        kindLabel: '電源',
        color: null,
        assignmentCount: 0,
        connectionGroupCount: 0,
      },
      {
        id: 'ground',
        name: 'GND',
        kind: 'ground',
        kindLabel: 'GND',
        color: null,
        assignmentCount: 0,
        connectionGroupCount: 0,
      },
    ])
  })

  it('部品端子一覧へ移動と回転後の実座標を1始まりで表示する', () => {
    const resistor = withPartRotation(
      createPart('resistor', 'part-1', 'R1', { column: 4, row: 4 }),
      90,
    )
    const nets: Net[] = [{ id: 'signal', name: 'DATA', kind: 'signal' }]
    const rows = getPartPinRows(
      resistor,
      [{ partId: resistor.id, pinNumber: '2', netId: 'signal' }],
      nets,
    )

    expect(rows).toMatchObject([
      {
        pinNumber: '1',
        point: { column: 4, row: 4 },
        displayColumn: 5,
        displayRow: 5,
        netId: null,
      },
      {
        pinNumber: '2',
        point: { column: 4, row: 8 },
        displayColumn: 5,
        displayRow: 9,
        netId: 'signal',
        netName: 'DATA',
      },
    ])
  })

  it('問題を重大、エラー、警告の指定優先順で日本語表示する', () => {
    const base = {
      groupIds: ['group-1'],
      netIds: [],
      pins: [],
      wireIds: [],
      holes: [],
    }
    const issues: ConnectivityIssue[] = [
      { ...base, type: 'unconnected-assigned-pin' },
      { ...base, type: 'net-conflict' },
      { ...base, type: 'disconnected-net' },
      { ...base, type: 'power-ground-short' },
    ]
    const sorted = sortConnectivityIssues(issues)
    const items = getIssueListItems(sorted, [], [])

    expect(sorted.map((issue) => issue.type)).toEqual([
      'power-ground-short',
      'net-conflict',
      'disconnected-net',
      'unconnected-assigned-pin',
    ])
    expect(items.map((item) => [item.severityLabel, item.title])).toEqual([
      ['重大', '電源とGNDが接続されています'],
      ['エラー', '異なるネット同士が接続されています'],
      ['警告', '同じネットが複数の接続グループに分断されています'],
      ['警告', 'ネット割り当て済みの端子が接続されていません'],
    ])
  })

  it('問題選択から穴、端子、配線、部品の強調対象を作る', () => {
    const issue: ConnectivityIssue = {
      type: 'net-conflict',
      groupIds: ['group-4'],
      netIds: ['a', 'b'],
      pins: [
        {
          partId: 'part-1',
          pinNumber: '1',
          hole: { column: 2, row: 3 },
        },
      ],
      wireIds: ['wire-1'],
      holes: [{ column: 2, row: 3 }],
    }

    expect(getIssueHighlight(issue)).toMatchObject({
      label: 'エラー',
      tone: 'error',
      holes: [{ column: 2, row: 3 }],
      pins: [{ partId: 'part-1', pinNumber: '1' }],
      wireIds: ['wire-1'],
      partIds: ['part-1'],
      groupIds: ['group-4'],
    })
  })

  it('ネット選択中はそのネットに関係する検査結果だけを返す', () => {
    const issues: ConnectivityIssue[] = [
      {
        type: 'net-conflict',
        groupIds: ['group-1'],
        netIds: ['signal', 'ground'],
        pins: [],
        wireIds: [],
        holes: [],
      },
      {
        type: 'unconnected-assigned-pin',
        groupIds: ['group-2'],
        netIds: ['power'],
        pins: [],
        wireIds: [],
        holes: [],
      },
    ]

    expect(getIssuesForNet(issues, 'ground')).toEqual([issues[0]])
    expect(getIssuesForNet(issues, 'power')).toEqual([issues[1]])
    expect(getIssuesForNet(issues, null)).toEqual(issues)
  })

  it('ネット強調では接続配線を含め、混在ネットの問題表示を優先する', () => {
    const powerPart = createPart('led', 'power-part', 'LED1', {
      column: 1,
      row: 1,
    })
    const groundPart = createPart('led', 'ground-part', 'LED2', {
      column: 4,
      row: 1,
    })
    const nets: Net[] = [
      { id: 'power', name: '3V3', kind: 'power', color: '#ff0000' },
      { id: 'ground', name: 'GND', kind: 'ground' },
    ]
    const assignments: PinNetAssignment[] = [
      { partId: powerPart.id, pinNumber: 'A', netId: 'power' },
      { partId: groundPart.id, pinNumber: 'A', netId: 'ground' },
    ]
    const wire = createWire(
      'wire-1',
      'front',
      { column: 1, row: 1 },
      { column: 4, row: 1 },
    )
    const analysis = analyzeConnectivity({
      board: DEFAULT_BOARD,
      parts: [powerPart, groundPart],
      wires: [wire],
      nets,
      pinNetAssignments: assignments,
    })
    const highlight = getNetHighlight(nets[0], assignments, analysis)

    expect(highlight).toMatchObject({
      label: '重大',
      tone: 'critical',
      wireIds: ['wire-1'],
      partIds: ['power-part'],
    })
    expect(highlight.color).toBeUndefined()
  })

  it('ネット・割り当ての有無と検査成功を区別して説明する', () => {
    expect(getInspectionEmptyMessage([], [], [])).toContain(
      'ネットがまだありません',
    )
    expect(
      getInspectionEmptyMessage(
        [{ id: 'signal', name: 'DATA', kind: 'signal' }],
        [],
        [],
      ),
    ).toContain('端子へのネット割り当てがまだありません')
    expect(
      getInspectionEmptyMessage(
        [{ id: 'signal', name: 'DATA', kind: 'signal' }],
        [{ partId: 'part-1', pinNumber: '1', netId: 'signal' }],
        [],
      ),
    ).toBe('接続上の問題は見つかりませんでした。')
  })
})
