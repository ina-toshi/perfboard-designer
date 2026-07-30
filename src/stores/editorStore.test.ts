import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD } from '../domain/board'
import {
  editorReducer,
  getSelectedPart,
  getSelectedWire,
  INITIAL_EDITOR_STATE,
} from './editorStore'

describe('editorReducer', () => {
  it('部品と配線を同じ差分だけまとめて移動する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const withPart = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'resistor-1',
      origin: { column: 4, row: 5 },
    })
    const withWire = {
      ...withPart,
      wires: [
        {
          id: 'wire-1',
          side: 'front' as const,
          kind: 'jumper' as const,
          color: '#2563eb',
          points: [
            { column: 4, row: 5 },
            { column: 7, row: 5 },
          ],
        },
      ],
    }

    const moved = editorReducer(withWire, {
      type: 'move-layout',
      offset: { column: 2, row: -3 },
    })

    expect(moved.parts[0]).toMatchObject({
      id: 'resistor-1',
      origin: { column: 6, row: 2 },
    })
    expect(moved.wires[0]?.points).toEqual([
      { column: 6, row: 2 },
      { column: 9, row: 2 },
    ])
    expect(moved.selectedPartId).toBe('resistor-1')
    expect(withWire.parts[0]?.origin).toEqual({ column: 4, row: 5 })
  })

  it('配置全体が基板外へ出る移動と編集途中の移動を拒否する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const atEdge = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'resistor-1',
      origin: { column: 25, row: 4 },
    })
    const outside = editorReducer(atEdge, {
      type: 'move-layout',
      offset: { column: 1, row: 0 },
    })
    const placingAgain = editorReducer(atEdge, {
      type: 'begin-new-part',
      kind: 'led',
    })
    const duringPlacement = editorReducer(placingAgain, {
      type: 'move-layout',
      offset: { column: 1, row: 0 },
    })

    expect(outside.parts).toBe(atEdge.parts)
    expect(outside.error).toBe(
      '基板外へはみ出すため、配置全体を移動できません。',
    )
    expect(duringPlacement.parts).toBe(atEdge.parts)
    expect(duringPlacement.error).toBe(
      '部品の配置または配線の作成を完了・中止してから全体を移動してください。',
    )
  })

  it('部品と配線を個別に移動し、基板外への移動を拒否する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const withPart = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'resistor-1',
      origin: { column: 4, row: 5 },
    })
    const withWire = {
      ...withPart,
      wires: [
        {
          id: 'wire-1',
          side: 'front' as const,
          kind: 'jumper' as const,
          color: '#2563eb',
          points: [
            { column: 4, row: 5 },
            { column: 7, row: 5 },
          ],
        },
      ],
    }

    const movedPart = editorReducer(withWire, {
      type: 'move-part-by-offset',
      partId: 'resistor-1',
      offset: { column: 2, row: 1 },
    })
    const movedWire = editorReducer(movedPart, {
      type: 'move-wire-by-offset',
      wireId: 'wire-1',
      offset: { column: -1, row: 3 },
    })
    const rejected = editorReducer(movedWire, {
      type: 'move-wire-by-offset',
      wireId: 'wire-1',
      offset: { column: -10, row: 0 },
    })

    expect(movedPart.parts[0]?.origin).toEqual({ column: 6, row: 6 })
    expect(movedWire.wires[0]?.points).toEqual([
      { column: 3, row: 8 },
      { column: 6, row: 8 },
    ])
    expect(rejected.wires).toBe(movedWire.wires)
    expect(rejected.error).toBe('配線が基板外へ出るため移動できません。')
  })

  it('配線の始点または終点だけを移動する', () => {
    const state = {
      ...INITIAL_EDITOR_STATE,
      wires: [
        {
          id: 'wire-1',
          side: 'front' as const,
          kind: 'jumper' as const,
          color: '#2563eb',
          points: [
            { column: 4, row: 5 },
            { column: 7, row: 5 },
          ],
        },
      ],
    }

    const movedStart = editorReducer(state, {
      type: 'move-wire-endpoint',
      wireId: 'wire-1',
      endpointIndex: 0,
      point: { column: 2, row: 8 },
    })
    const movedEnd = editorReducer(movedStart, {
      type: 'move-wire-endpoint',
      wireId: 'wire-1',
      endpointIndex: 1,
      point: { column: 9, row: 3 },
    })
    const zeroLength = editorReducer(movedEnd, {
      type: 'move-wire-endpoint',
      wireId: 'wire-1',
      endpointIndex: 1,
      point: { column: 2, row: 8 },
    })

    expect(movedStart.wires[0]?.points).toEqual([
      { column: 2, row: 8 },
      { column: 7, row: 5 },
    ])
    expect(movedEnd.wires[0]?.points).toEqual([
      { column: 2, row: 8 },
      { column: 9, row: 3 },
    ])
    expect(zeroLength.wires).toBe(movedEnd.wires)
    expect(zeroLength.error).toBe('始点と終点は異なる穴へ置いてください。')
  })

  it('配置アクションで部品を追加して選択する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'resistor-1',
      origin: { column: 5, row: 6 },
    })

    expect(placed.parts).toHaveLength(1)
    expect(getSelectedPart(placed)).toMatchObject({
      id: 'resistor-1',
      reference: 'R1',
      origin: { column: 5, row: 6 },
    })
    expect(placed.placement).toBeNull()
  })

  it('移動、回転、設定変更を不変データ更新で適用する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'led',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'led-1',
      origin: { column: 4, row: 4 },
    })
    const moving = editorReducer(placed, {
      type: 'begin-move-part',
      partId: 'led-1',
    })
    const moved = editorReducer(moving, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'unused',
      origin: { column: 8, row: 8 },
    })
    const rotated = editorReducer(moved, {
      type: 'rotate-selected-part',
      board: DEFAULT_BOARD,
    })
    const renamed = editorReducer(rotated, {
      type: 'update-selected-settings',
      reference: 'LED5',
      value: '緑色',
    })

    expect(placed.parts[0].origin).toEqual({ column: 4, row: 4 })
    expect(getSelectedPart(renamed)).toMatchObject({
      reference: 'LED5',
      value: '緑色',
      origin: { column: 8, row: 8 },
      rotation: 90,
    })
  })

  it('基板外への配置を拒否し、削除では対象だけを取り除く', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'dip',
    })
    const rejected = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'dip-1',
      origin: { column: 29, row: 19 },
    })

    expect(rejected.parts).toHaveLength(0)
    expect(rejected.error).toBe('部品が基板内に収まる位置を選んでください。')

    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'dip-1',
      origin: { column: 10, row: 10 },
    })
    const deleted = editorReducer(placed, { type: 'delete-selected-part' })

    expect(deleted.parts).toHaveLength(0)
    expect(deleted.selectedPartId).toBeNull()
  })

  it.each([
    ['diode', 'D1'],
    ['capacitor', 'C1'],
    ['pin-header', 'J1'],
    ['connector', 'J1'],
    ['tactile-switch', 'SW1'],
  ] as const)('%sを共通配置処理で追加する', (kind, reference) => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind,
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: `${kind}-1`,
      origin: { column: 10, row: 10 },
    })

    expect(getSelectedPart(placed)).toMatchObject({
      kind,
      reference,
      origin: { column: 10, row: 10 },
    })
  })

  it('ピンヘッダーと汎用コネクタのJ番号を重複させない', () => {
    const headerPlacement = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'pin-header',
    })
    const headerPlaced = editorReducer(headerPlacement, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'header-1',
      origin: { column: 2, row: 2 },
    })
    const connectorPlacement = editorReducer(headerPlaced, {
      type: 'begin-new-part',
      kind: 'connector',
    })
    const connectorPlaced = editorReducer(connectorPlacement, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'connector-1',
      origin: { column: 5, row: 2 },
    })

    expect(connectorPlaced.parts.map((part) => part.reference)).toEqual([
      'J1',
      'J2',
    ])
  })

  it('コンデンサの極性変更でユーザー指定値を保持する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'capacitor',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'capacitor-1',
      origin: { column: 5, row: 5 },
    })
    const renamed = editorReducer(placed, {
      type: 'update-selected-settings',
      reference: 'C10',
      value: '100µF',
    })
    const polarized = editorReducer(renamed, {
      type: 'change-selected-capacitor-polarity',
      polarized: true,
    })

    expect(getSelectedPart(polarized)).toMatchObject({
      reference: 'C10',
      value: '100µF',
      polarized: true,
    })
  })

  it('LEDの発光色を変更する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'led',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'led-1',
      origin: { column: 5, row: 5 },
    })
    const recolored = editorReducer(placed, {
      type: 'change-selected-led-color',
      color: 'blue',
    })

    expect(getSelectedPart(recolored)).toMatchObject({ color: 'blue' })
  })

  it('2列ピンヘッダーの奇数端子を拒否する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'pin-header',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'header-1',
      origin: { column: 5, row: 5 },
    })
    const twoColumns = editorReducer(placed, {
      type: 'change-selected-pin-header-columns',
      columns: 2,
      board: DEFAULT_BOARD,
    })
    const rejected = editorReducer(twoColumns, {
      type: 'change-selected-pin-count',
      pinCount: 5,
      board: DEFAULT_BOARD,
    })

    expect(getSelectedPart(twoColumns)).toMatchObject({
      columns: 2,
      pinCount: 4,
    })
    expect(getSelectedPart(rejected)).toMatchObject({
      columns: 2,
      pinCount: 4,
    })
    expect(rejected.error).toBe('2列ピンヘッダーの端子数は偶数にしてください。')
  })

  it('ピンヘッダーのオスとメスを切り替える', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'pin-header',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'header-1',
      origin: { column: 5, row: 5 },
    })
    const changed = editorReducer(placed, {
      type: 'change-selected-pin-header-gender',
      gender: 'female',
    })

    expect(getSelectedPart(placed)).toMatchObject({ gender: 'male' })
    expect(getSelectedPart(changed)).toMatchObject({ gender: 'female' })
  })

  it('ピンヘッダーの番号を反転してもネット割り当てを物理端子に維持する', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'pin-header',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'header-1',
      origin: { column: 5, row: 5 },
    })
    const withNet = {
      ...placed,
      nets: [{ id: 'net-1', name: 'DATA', kind: 'signal' as const }],
    }
    const assigned = editorReducer(withNet, {
      type: 'assign-pin-net',
      partId: 'header-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const reversed = editorReducer(assigned, {
      type: 'change-selected-pin-header-numbering',
      numbering: 'reversed',
    })

    expect(getSelectedPart(reversed)).toMatchObject({ numbering: 'reversed' })
    expect(getSelectedPart(reversed)?.pins[0]).toEqual({
      number: '4',
      offset: { column: 0, row: 0 },
    })
    expect(reversed.pinNetAssignments).toEqual([
      { partId: 'header-1', pinNumber: '4', netId: 'net-1' },
    ])
  })

  it('ピンヘッダーと汎用コネクタの端子数を変更する', () => {
    const headerPlacement = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'pin-header',
    })
    const headerPlaced = editorReducer(headerPlacement, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'header-1',
      origin: { column: 3, row: 3 },
    })
    const headerChanged = editorReducer(headerPlaced, {
      type: 'change-selected-pin-count',
      pinCount: 6,
      board: DEFAULT_BOARD,
    })
    const connectorPlacement = editorReducer(headerChanged, {
      type: 'begin-new-part',
      kind: 'connector',
    })
    const connectorPlaced = editorReducer(connectorPlacement, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'connector-1',
      origin: { column: 8, row: 3 },
    })
    const connectorChanged = editorReducer(connectorPlaced, {
      type: 'change-selected-pin-count',
      pinCount: 5,
      board: DEFAULT_BOARD,
    })

    expect(headerChanged.parts[0].pins).toHaveLength(6)
    expect(getSelectedPart(connectorChanged)?.pins).toHaveLength(5)
  })

  it.each([
    ['wire-front', 'front', 'jumper'],
    ['wire-back', 'back', 'solder'],
    ['wire-back-jumper', 'back', 'jumper'],
  ] as const)('%sツールで%sの%sを作成する', (tool, side, kind) => {
    const toolSelected = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'set-active-tool',
      tool,
    })
    const started = editorReducer(toolSelected, {
      type: 'wire-point-click',
      board: DEFAULT_BOARD,
      id: 'unused',
      point: { column: 3, row: 4 },
    })
    const previewed = editorReducer(started, {
      type: 'set-wire-preview',
      end: { column: 8, row: 6 },
    })
    const completed = editorReducer(previewed, {
      type: 'wire-point-click',
      board: DEFAULT_BOARD,
      id: `wire-${side}-${kind}-1`,
      point: { column: 8, row: 6 },
    })

    expect(previewed.wires).toHaveLength(0)
    expect(previewed.wireDraft).toMatchObject({
      side,
      kind,
      start: { column: 3, row: 4 },
      previewEnd: { column: 8, row: 6 },
    })
    expect(getSelectedWire(completed)).toMatchObject({
      id: `wire-${side}-${kind}-1`,
      side,
      kind,
      points: [
        { column: 3, row: 4 },
        { column: 8, row: 6 },
      ],
    })
    expect(completed.wireDraft).toBeNull()
  })

  it('基板外の配線端点を拒否する', () => {
    const toolSelected = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'set-active-tool',
      tool: 'wire-front',
    })
    const rejected = editorReducer(toolSelected, {
      type: 'wire-point-click',
      board: DEFAULT_BOARD,
      id: 'wire-1',
      point: { column: 30, row: 5 },
    })

    expect(rejected.wires).toHaveLength(0)
    expect(rejected.wireDraft).toBeNull()
    expect(rejected.error).toBe('基板内の穴を選んでください。')
  })

  it('長さ0の配線を拒否して作成途中を維持する', () => {
    const toolSelected = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'set-active-tool',
      tool: 'wire-back',
    })
    const started = editorReducer(toolSelected, {
      type: 'wire-point-click',
      board: DEFAULT_BOARD,
      id: 'unused',
      point: { column: 5, row: 5 },
    })
    const rejected = editorReducer(started, {
      type: 'wire-point-click',
      board: DEFAULT_BOARD,
      id: 'wire-1',
      point: { column: 5, row: 5 },
    })

    expect(rejected.wires).toHaveLength(0)
    expect(rejected.wireDraft?.start).toEqual({ column: 5, row: 5 })
    expect(rejected.error).toBe('始点と異なる穴を終点として選んでください。')
  })

  it('配線作成を中止しても確定済み配線を保持する', () => {
    const withExistingWire = {
      ...INITIAL_EDITOR_STATE,
      wires: [
        {
          id: 'wire-existing',
          side: 'front' as const,
          kind: 'jumper' as const,
          color: '#2563eb',
          points: [
            { column: 1, row: 1 },
            { column: 4, row: 1 },
          ],
        },
      ],
      activeTool: 'wire-front' as const,
      wireDraft: {
        side: 'front' as const,
        kind: 'jumper' as const,
        start: { column: 7, row: 7 },
        previewEnd: { column: 9, row: 9 },
        color: '#2563eb',
      },
    }
    const cancelled = editorReducer(withExistingWire, {
      type: 'cancel-active-operation',
    })

    expect(cancelled.wireDraft).toBeNull()
    expect(cancelled.wires).toEqual(withExistingWire.wires)
  })

  it('選択中配線の色、面、種類を変更して削除する', () => {
    const stateWithWire = {
      ...INITIAL_EDITOR_STATE,
      wires: [
        {
          id: 'wire-1',
          side: 'front' as const,
          kind: 'jumper' as const,
          color: '#2563eb',
          points: [
            { column: 2, row: 2 },
            { column: 6, row: 2 },
          ],
        },
      ],
    }
    const selected = editorReducer(stateWithWire, {
      type: 'select-wire',
      wireId: 'wire-1',
    })
    const recolored = editorReducer(selected, {
      type: 'change-selected-wire-color',
      color: '#039855',
    })
    const movedToBack = editorReducer(recolored, {
      type: 'change-selected-wire-side',
      side: 'back',
    })
    const changedToSolder = editorReducer(movedToBack, {
      type: 'change-selected-wire-kind',
      kind: 'solder',
    })
    const deleted = editorReducer(changedToSolder, {
      type: 'delete-selected-wire',
    })

    expect(getSelectedWire(changedToSolder)).toMatchObject({
      side: 'back',
      kind: 'solder',
      color: '#039855',
      points: [
        { column: 2, row: 2 },
        { column: 6, row: 2 },
      ],
    })
    expect(deleted.wires).toHaveLength(0)
    expect(deleted.selectedWireId).toBeNull()
  })

  it('部品操作と配線操作をツールで切り替える', () => {
    const partPlacement = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const partPlaced = editorReducer(partPlacement, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'resistor-1',
      origin: { column: 4, row: 4 },
    })
    const wireTool = editorReducer(partPlaced, {
      type: 'set-active-tool',
      tool: 'wire-front',
    })
    const ignoredPartSelection = editorReducer(wireTool, {
      type: 'select-part',
      partId: 'resistor-1',
    })
    const partToolAgain = editorReducer(ignoredPartSelection, {
      type: 'begin-new-part',
      kind: 'led',
    })

    expect(wireTool.selectedPartId).toBeNull()
    expect(ignoredPartSelection.selectedPartId).toBeNull()
    expect(partToolAgain.activeTool).toBe('select')
    expect(partToolAgain.placement).toMatchObject({
      mode: 'new',
      kind: 'led',
    })
  })

  it('ネット名を正規化し、重複ID・重複名・不正色を拒否する', () => {
    const created = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'create-net',
      id: 'net-1',
      name: ' DATA ',
      kind: 'signal',
      color: '#123abc',
    })
    const duplicateId = editorReducer(created, {
      type: 'create-net',
      id: 'net-1',
      name: 'OTHER',
      kind: 'signal',
    })
    const duplicateName = editorReducer(created, {
      type: 'create-net',
      id: 'net-2',
      name: ' data ',
      kind: 'signal',
    })
    const invalidColor = editorReducer(created, {
      type: 'update-net',
      netId: 'net-1',
      name: 'DATA',
      kind: 'signal',
      color: 'red',
    })

    expect(created.nets).toEqual([
      { id: 'net-1', name: 'DATA', kind: 'signal', color: '#123abc' },
    ])
    expect(duplicateId.nets).toBe(created.nets)
    expect(duplicateName.nets).toBe(created.nets)
    expect(invalidColor.nets).toBe(created.nets)
  })

  it('存在する部品端子へだけネットを一意に割り当てる', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'part-1',
      origin: { column: 2, row: 2 },
    })
    const withNet = editorReducer(placed, {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA',
      kind: 'signal',
    })
    const assigned = editorReducer(withNet, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const duplicate = editorReducer(assigned, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const missingPin = editorReducer(assigned, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '999',
      netId: 'net-1',
    })

    expect(assigned.pinNetAssignments).toEqual([
      { partId: 'part-1', pinNumber: '1', netId: 'net-1' },
    ])
    expect(duplicate.pinNetAssignments).toBe(assigned.pinNetAssignments)
    expect(missingPin.pinNetAssignments).toBe(assigned.pinNetAssignments)
  })

  it('タクトSWの上側と下側へ別々のネットを割り当てる', () => {
    const placing = editorReducer(INITIAL_EDITOR_STATE, {
      type: 'begin-new-part',
      kind: 'tactile-switch',
    })
    const placed = editorReducer(placing, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'switch-1',
      origin: { column: 2, row: 2 },
    })
    const withNet = editorReducer(placed, {
      type: 'create-net',
      id: 'net-1',
      name: 'TOP',
      kind: 'signal',
    })
    const withSecondNet = editorReducer(withNet, {
      type: 'create-net',
      id: 'net-2',
      name: 'BOTTOM',
      kind: 'signal',
    })
    const topAssigned = editorReducer(withSecondNet, {
      type: 'assign-tactile-switch-group-net',
      partId: 'switch-1',
      group: 'top',
      netId: 'net-1',
    })
    const assigned = editorReducer(topAssigned, {
      type: 'assign-tactile-switch-group-net',
      partId: 'switch-1',
      group: 'bottom',
      netId: 'net-2',
    })
    const rejectedIndividualAssignment = editorReducer(withSecondNet, {
      type: 'assign-pin-net',
      partId: 'switch-1',
      pinNumber: 'A1',
      netId: 'net-1',
    })
    const unassigned = editorReducer(assigned, {
      type: 'unassign-tactile-switch-group-net',
      partId: 'switch-1',
      group: 'top',
    })

    expect(assigned.pinNetAssignments).toEqual([
      { partId: 'switch-1', pinNumber: 'A1', netId: 'net-1' },
      { partId: 'switch-1', pinNumber: 'A2', netId: 'net-1' },
      { partId: 'switch-1', pinNumber: 'B1', netId: 'net-2' },
      { partId: 'switch-1', pinNumber: 'B2', netId: 'net-2' },
    ])
    expect(rejectedIndividualAssignment.pinNetAssignments).toEqual([])
    expect(rejectedIndividualAssignment.error).toBe(
      'タクトSWのネットは上側または下側の端子組から割り当ててください。',
    )
    expect(unassigned.pinNetAssignments).toEqual([
      { partId: 'switch-1', pinNumber: 'B1', netId: 'net-2' },
      { partId: 'switch-1', pinNumber: 'B2', netId: 'net-2' },
    ])
  })

  it('部品移動と回転では端子割り当てを維持する', () => {
    const initial = {
      ...INITIAL_EDITOR_STATE,
      parts: [
        {
          ...editorReducer(
            editorReducer(INITIAL_EDITOR_STATE, {
              type: 'begin-new-part',
              kind: 'resistor',
            }),
            {
              type: 'commit-placement',
              board: DEFAULT_BOARD,
              id: 'part-1',
              origin: { column: 2, row: 2 },
            },
          ).parts[0],
        },
      ],
      nets: [{ id: 'net-1', name: 'DATA', kind: 'signal' as const }],
      pinNetAssignments: [{ partId: 'part-1', pinNumber: '1', netId: 'net-1' }],
      selectedPartId: 'part-1',
    }
    const moving = editorReducer(initial, {
      type: 'begin-move-part',
      partId: 'part-1',
    })
    const moved = editorReducer(moving, {
      type: 'commit-placement',
      board: DEFAULT_BOARD,
      id: 'unused',
      origin: { column: 6, row: 6 },
    })
    const rotated = editorReducer(moved, {
      type: 'rotate-selected-part',
      board: DEFAULT_BOARD,
    })

    expect(rotated.pinNetAssignments).toEqual(initial.pinNetAssignments)
  })
})
