import { describe, expect, it } from 'vitest'
import type { GridPoint } from '../domain/board'
import type { PartKind } from '../domain/parts'
import {
  EDITOR_HISTORY_LIMIT,
  createEditorHistoryState,
  editorHistoryReducer,
  getEditorKeyboardShortcut,
  getHistoryShortcutAction,
  type EditorHistoryAction,
  type EditorHistoryState,
} from './editorHistory'

function reduce(
  state: EditorHistoryState,
  action: EditorHistoryAction,
): EditorHistoryState {
  return editorHistoryReducer(state, action)
}

function placePart(
  state: EditorHistoryState,
  kind: PartKind,
  id: string,
  origin: GridPoint,
): EditorHistoryState {
  const placing = reduce(state, { type: 'begin-new-part', kind })
  return reduce(placing, {
    type: 'commit-placement',
    board: placing.present.board,
    id,
    origin,
  })
}

function addWire(
  state: EditorHistoryState,
  id: string,
  start: GridPoint,
  end: GridPoint,
  side: 'front' | 'back' = 'front',
): EditorHistoryState {
  const toolSelected = reduce(state, {
    type: 'set-active-tool',
    tool: side === 'front' ? 'wire-front' : 'wire-back',
  })
  const started = reduce(toolSelected, {
    type: 'wire-point-click',
    board: toolSelected.present.board,
    id: 'unused',
    point: start,
  })
  return reduce(started, {
    type: 'wire-point-click',
    board: started.present.board,
    id,
    point: end,
  })
}

describe('editorHistoryReducer', () => {
  it.each([
    ['meta', true, false, false, 'undo'],
    ['meta+shift', true, false, true, 'redo'],
    ['ctrl', false, true, false, 'undo'],
    ['ctrl+shift', false, true, true, 'redo'],
  ] as const)(
    '%s+Zを%sとして解釈する',
    (_label, metaKey, ctrlKey, shiftKey, expected) => {
      expect(
        getHistoryShortcutAction({
          key: 'z',
          metaKey,
          ctrlKey,
          shiftKey,
          altKey: false,
        }),
      ).toBe(expected)
    },
  )

  it.each([
    ['v', 'select-tool'],
    ['F', 'wire-front-tool'],
    ['b', 'wire-back-tool'],
    ['j', 'wire-back-jumper-tool'],
    ['r', 'rotate-selected-part'],
    ['Delete', 'delete-selected'],
    ['Backspace', 'delete-selected'],
  ] as const)('%sキーを%sとして解釈する', (key, expected) => {
    expect(
      getEditorKeyboardShortcut({
        key,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(expected)
  })

  it('修飾キー付きの編集ショートカットを無視する', () => {
    expect(
      getEditorKeyboardShortcut({
        key: 'f',
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBeNull()
  })

  it('部品追加を同じIDでUndo・Redoする', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 4, row: 4 },
    )
    const undone = reduce(added, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(added.past).toHaveLength(1)
    expect(undone.present.parts).toHaveLength(0)
    expect(redone.present.parts[0]).toMatchObject({
      id: 'resistor-1',
      origin: { column: 4, row: 4 },
    })
  })

  it('復元した設計のピンヘッダーを選択できる', () => {
    const source = placePart(
      createEditorHistoryState(),
      'pin-header',
      'header-1',
      { column: 4, row: 4 },
    )
    const restored = reduce(createEditorHistoryState(), {
      type: 'replace-design',
      design: {
        metadata: source.present.metadata,
        board: source.present.board,
        parts: source.present.parts,
        wires: source.present.wires,
        nets: source.present.nets,
        pinNetAssignments: source.present.pinNetAssignments,
      },
    })
    const selected = reduce(restored, {
      type: 'select-part',
      partId: 'header-1',
    })

    expect(selected.present.activeTool).toBe('select')
    expect(selected.present.selectedPartId).toBe('header-1')
    expect(selected.present.parts[0]).toMatchObject({
      kind: 'pin-header',
      gender: 'male',
      numbering: 'normal',
    })
  })

  it('部品移動と回転をそれぞれ1操作としてUndo・Redoする', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 4, row: 4 },
    )
    const moving = reduce(added, {
      type: 'begin-move-part',
      partId: 'resistor-1',
    })
    const previewed = reduce(moving, {
      type: 'set-placement-preview',
      origin: { column: 8, row: 7 },
    })
    const moved = reduce(previewed, {
      type: 'commit-placement',
      board: previewed.present.board,
      id: 'unused',
      origin: { column: 8, row: 7 },
    })
    const moveUndone = reduce(moved, { type: 'undo' })
    const moveRedone = reduce(moveUndone, { type: 'redo' })
    const rotated = reduce(moveRedone, {
      type: 'rotate-selected-part',
      board: moveRedone.present.board,
    })
    const rotationUndone = reduce(rotated, { type: 'undo' })
    const rotationRedone = reduce(rotationUndone, { type: 'redo' })

    expect(moved.past).toHaveLength(2)
    expect(moveUndone.present.parts[0].origin).toEqual({
      column: 4,
      row: 4,
    })
    expect(moveRedone.present.parts[0].origin).toEqual({
      column: 8,
      row: 7,
    })
    expect(rotationUndone.present.parts[0].rotation).toBe(0)
    expect(rotationRedone.present.parts[0]).toMatchObject({
      id: 'resistor-1',
      rotation: 90,
    })
  })

  it('配置全体の移動を1操作としてUndo・Redoする', () => {
    const partAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 4, row: 4 },
    )
    const prepared = addWire(
      partAdded,
      'wire-1',
      { column: 4, row: 4 },
      { column: 7, row: 4 },
    )
    const moved = reduce(prepared, {
      type: 'move-layout',
      offset: { column: 2, row: 3 },
    })
    const undone = reduce(moved, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(moved.past).toHaveLength(3)
    expect(moved.present.parts[0]?.origin).toEqual({ column: 6, row: 7 })
    expect(moved.present.wires[0]?.points).toEqual([
      { column: 6, row: 7 },
      { column: 9, row: 7 },
    ])
    expect(undone.present.parts[0]?.origin).toEqual({ column: 4, row: 4 })
    expect(undone.present.wires[0]?.points).toEqual([
      { column: 4, row: 4 },
      { column: 7, row: 4 },
    ])
    expect(redone.present.parts[0]?.origin).toEqual({ column: 6, row: 7 })
  })

  it('ドラッグによる個別の部品・配線移動を1操作としてUndo・Redoする', () => {
    const partAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 4, row: 4 },
    )
    const prepared = addWire(
      partAdded,
      'wire-1',
      { column: 4, row: 4 },
      { column: 7, row: 4 },
    )
    const partMoved = reduce(prepared, {
      type: 'move-part-by-offset',
      partId: 'resistor-1',
      offset: { column: 2, row: 3 },
    })
    const wireMoved = reduce(partMoved, {
      type: 'move-wire-by-offset',
      wireId: 'wire-1',
      offset: { column: 1, row: -2 },
    })
    const undone = reduce(wireMoved, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(partMoved.past).toHaveLength(3)
    expect(wireMoved.past).toHaveLength(4)
    expect(undone.present.wires[0]?.points).toEqual([
      { column: 4, row: 4 },
      { column: 7, row: 4 },
    ])
    expect(redone.present.wires[0]?.points).toEqual([
      { column: 5, row: 2 },
      { column: 8, row: 2 },
    ])
  })

  it('配線端点の再配置を1操作としてUndo・Redoする', () => {
    const partAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 4, row: 4 },
    )
    const prepared = addWire(
      partAdded,
      'wire-1',
      { column: 4, row: 4 },
      { column: 7, row: 4 },
    )
    const moved = reduce(prepared, {
      type: 'move-wire-endpoint',
      wireId: 'wire-1',
      endpointIndex: 1,
      point: { column: 9, row: 8 },
    })
    const undone = reduce(moved, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(moved.past).toHaveLength(3)
    expect(undone.present.wires[0]?.points).toEqual([
      { column: 4, row: 4 },
      { column: 7, row: 4 },
    ])
    expect(redone.present.wires[0]?.points).toEqual([
      { column: 4, row: 4 },
      { column: 9, row: 8 },
    ])
  })

  it('部品番号と値の設定変更を一括でUndo・Redoする', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 4, row: 4 },
    )
    const changed = reduce(added, {
      type: 'update-selected-settings',
      reference: 'R10',
      value: '4.7kΩ',
    })
    const undone = reduce(changed, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(changed.past).toHaveLength(2)
    expect(undone.present.parts[0]).toMatchObject({
      reference: 'R1',
      value: '1kΩ',
    })
    expect(redone.present.parts[0]).toMatchObject({
      id: 'resistor-1',
      reference: 'R10',
      value: '4.7kΩ',
    })
  })

  it('端子数、極性、LED色、列数、種類、番号の向きをUndo・Redoする', () => {
    const dipAdded = placePart(createEditorHistoryState(), 'dip', 'dip-1', {
      column: 3,
      row: 3,
    })
    const dipChanged = reduce(dipAdded, {
      type: 'change-selected-dip-pin-count',
      pinCount: 14,
      board: dipAdded.present.board,
    })
    const dipUndone = reduce(dipChanged, { type: 'undo' })
    const dipRedone = reduce(dipUndone, { type: 'redo' })

    expect(dipUndone.present.parts[0]).toMatchObject({ pinCount: 8 })
    expect(dipRedone.present.parts[0]).toMatchObject({ pinCount: 14 })

    const capacitorAdded = placePart(
      createEditorHistoryState(),
      'capacitor',
      'capacitor-1',
      { column: 3, row: 3 },
    )
    const polarityChanged = reduce(capacitorAdded, {
      type: 'change-selected-capacitor-polarity',
      polarized: true,
    })
    const polarityUndone = reduce(polarityChanged, { type: 'undo' })
    const polarityRedone = reduce(polarityUndone, { type: 'redo' })

    expect(polarityUndone.present.parts[0]).toMatchObject({
      polarized: false,
    })
    expect(polarityRedone.present.parts[0]).toMatchObject({ polarized: true })

    const ledAdded = placePart(createEditorHistoryState(), 'led', 'led-1', {
      column: 3,
      row: 3,
    })
    const colorChanged = reduce(ledAdded, {
      type: 'change-selected-led-color',
      color: 'green',
    })
    const colorUndone = reduce(colorChanged, { type: 'undo' })
    const colorRedone = reduce(colorUndone, { type: 'redo' })

    expect(colorUndone.present.parts[0]).toMatchObject({ color: 'red' })
    expect(colorRedone.present.parts[0]).toMatchObject({ color: 'green' })

    const headerAdded = placePart(
      createEditorHistoryState(),
      'pin-header',
      'header-1',
      { column: 3, row: 3 },
    )
    const columnsChanged = reduce(headerAdded, {
      type: 'change-selected-pin-header-columns',
      columns: 2,
      board: headerAdded.present.board,
    })
    const pinsChanged = reduce(columnsChanged, {
      type: 'change-selected-pin-count',
      pinCount: 6,
      board: columnsChanged.present.board,
    })
    const pinsUndone = reduce(pinsChanged, { type: 'undo' })
    const columnsUndone = reduce(pinsUndone, { type: 'undo' })
    const columnsRedone = reduce(columnsUndone, { type: 'redo' })
    const pinsRedone = reduce(columnsRedone, { type: 'redo' })

    expect(pinsUndone.present.parts[0]).toMatchObject({ pinCount: 4 })
    expect(columnsUndone.present.parts[0]).toMatchObject({ columns: 1 })
    expect(columnsRedone.present.parts[0]).toMatchObject({ columns: 2 })
    expect(pinsRedone.present.parts[0]).toMatchObject({ pinCount: 6 })

    const genderChanged = reduce(pinsRedone, {
      type: 'change-selected-pin-header-gender',
      gender: 'female',
    })
    const genderUndone = reduce(genderChanged, { type: 'undo' })
    const genderRedone = reduce(genderUndone, { type: 'redo' })

    expect(genderUndone.present.parts[0]).toMatchObject({ gender: 'male' })
    expect(genderRedone.present.parts[0]).toMatchObject({ gender: 'female' })

    const numberingChanged = reduce(genderRedone, {
      type: 'change-selected-pin-header-numbering',
      numbering: 'reversed',
    })
    const numberingUndone = reduce(numberingChanged, { type: 'undo' })
    const numberingRedone = reduce(numberingUndone, { type: 'redo' })

    expect(numberingUndone.present.parts[0]).toMatchObject({
      numbering: 'normal',
    })
    expect(numberingRedone.present.parts[0]).toMatchObject({
      numbering: 'reversed',
    })
  })

  it('部品削除を同じID、設定、位置で復元する', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 7, row: 8 },
    )
    const configured = reduce(added, {
      type: 'update-selected-settings',
      reference: 'R42',
      value: '10kΩ',
    })
    const beforeDeletion = configured.present.parts[0]
    const deleted = reduce(configured, { type: 'delete-selected-part' })
    const restored = reduce(deleted, { type: 'undo' })
    const deletedAgain = reduce(restored, { type: 'redo' })

    expect(deleted.present.parts).toHaveLength(0)
    expect(restored.present.parts[0]).toEqual(beforeDeletion)
    expect(deletedAgain.present.parts).toHaveLength(0)
  })

  it('配線追加を同じIDとpointsでUndo・Redoする', () => {
    const added = addWire(
      createEditorHistoryState(),
      'wire-1',
      { column: 2, row: 3 },
      { column: 8, row: 7 },
      'back',
    )
    const undone = reduce(added, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(added.past).toHaveLength(1)
    expect(undone.present.wires).toHaveLength(0)
    expect(redone.present.wires[0]).toMatchObject({
      id: 'wire-1',
      side: 'back',
      points: [
        { column: 2, row: 3 },
        { column: 8, row: 7 },
      ],
    })
  })

  it('配線の色、面、削除を連続してUndo・Redoする', () => {
    const added = addWire(
      createEditorHistoryState(),
      'wire-1',
      { column: 2, row: 3 },
      { column: 8, row: 7 },
    )
    const recolored = reduce(added, {
      type: 'change-selected-wire-color',
      color: '#039855',
    })
    const movedToBack = reduce(recolored, {
      type: 'change-selected-wire-side',
      side: 'back',
    })
    const deleted = reduce(movedToBack, { type: 'delete-selected-wire' })
    const deletionUndone = reduce(deleted, { type: 'undo' })
    const sideUndone = reduce(deletionUndone, { type: 'undo' })
    const colorUndone = reduce(sideUndone, { type: 'undo' })
    const colorRedone = reduce(colorUndone, { type: 'redo' })
    const sideRedone = reduce(colorRedone, { type: 'redo' })
    const deletionRedone = reduce(sideRedone, { type: 'redo' })

    expect(deletionUndone.present.wires[0]).toMatchObject({
      id: 'wire-1',
      side: 'back',
      color: '#039855',
    })
    expect(sideUndone.present.wires[0].side).toBe('front')
    expect(colorUndone.present.wires[0].color).toBe('#2563eb')
    expect(colorRedone.present.wires[0].color).toBe('#039855')
    expect(sideRedone.present.wires[0].side).toBe('back')
    expect(deletionRedone.present.wires).toHaveLength(0)
  })

  it('Undo後の新しい編集でRedo履歴を破棄する', () => {
    const firstAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 3, row: 3 },
    )
    const undone = reduce(firstAdded, { type: 'undo' })
    const transientEdit = reduce(undone, {
      type: 'begin-new-part',
      kind: 'led',
    })
    const newlyEdited = reduce(transientEdit, {
      type: 'commit-placement',
      board: transientEdit.present.board,
      id: 'led-1',
      origin: { column: 5, row: 5 },
    })

    expect(transientEdit.future).toHaveLength(1)
    expect(newlyEdited.future).toHaveLength(0)
    expect(newlyEdited.present.parts.map((part) => part.id)).toEqual(['led-1'])
  })

  it('失敗操作を履歴へ追加しない', () => {
    const toolSelected = reduce(createEditorHistoryState(), {
      type: 'set-active-tool',
      tool: 'wire-front',
    })
    const started = reduce(toolSelected, {
      type: 'wire-point-click',
      board: toolSelected.present.board,
      id: 'unused',
      point: { column: 4, row: 4 },
    })
    const rejectedWire = reduce(started, {
      type: 'wire-point-click',
      board: started.present.board,
      id: 'wire-1',
      point: { column: 4, row: 4 },
    })
    const rejectedBoard = reduce(rejectedWire, {
      type: 'change-board',
      board: { columns: 0, rows: 20, pitchMm: 2.54 },
    })

    expect(rejectedBoard.past).toHaveLength(0)
    expect(rejectedBoard.present.wires).toHaveLength(0)
    expect(rejectedBoard.present.error).toBe(
      '基板の列数と行数は正の整数にしてください。',
    )
  })

  it('Escape中止を履歴へ追加しない', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 3, row: 3 },
    )
    const placing = reduce(added, {
      type: 'begin-new-part',
      kind: 'led',
    })
    const previewed = reduce(placing, {
      type: 'set-placement-preview',
      origin: { column: 7, row: 7 },
    })
    const cancelled = reduce(previewed, { type: 'cancel-active-operation' })

    expect(cancelled.past).toHaveLength(1)
    expect(cancelled.present.parts).toEqual(added.present.parts)
    expect(cancelled.present.placement).toBeNull()
  })

  it('一時状態を履歴へ保存せずUndo時に途中操作を中止する', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 3, row: 3 },
    )
    const toolSelected = reduce(added, {
      type: 'set-active-tool',
      tool: 'wire-front',
    })
    const drafting = reduce(toolSelected, {
      type: 'wire-point-click',
      board: toolSelected.present.board,
      id: 'unused',
      point: { column: 8, row: 8 },
    })
    const undone = reduce(drafting, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(drafting.past).toHaveLength(1)
    expect(undone.present.parts).toHaveLength(0)
    expect(undone.present.activeTool).toBe('wire-front')
    expect(undone.present.wireDraft).toBeNull()
    expect(undone.present.error).toBeNull()
    expect(redone.present.parts[0].id).toBe('resistor-1')
    expect(redone.present.activeTool).toBe('wire-front')
    expect(redone.present.wireDraft).toBeNull()
  })

  it('安全な基板設定変更をUndo・Redoする', () => {
    const changed = reduce(createEditorHistoryState(), {
      type: 'change-board',
      board: { columns: 40, rows: 25, pitchMm: 2.54 },
    })
    const undone = reduce(changed, { type: 'undo' })
    const redone = reduce(undone, { type: 'redo' })

    expect(changed.present.board).toMatchObject({ columns: 40, rows: 25 })
    expect(undone.present.board).toMatchObject({ columns: 30, rows: 20 })
    expect(redone.present.board).toMatchObject({ columns: 40, rows: 25 })
  })

  it('配置済み要素が基板外になる設定変更を履歴へ追加しない', () => {
    const added = placePart(
      createEditorHistoryState(),
      'resistor',
      'resistor-1',
      { column: 25, row: 4 },
    )
    const rejected = reduce(added, {
      type: 'change-board',
      board: { columns: 20, rows: 20, pitchMm: 2.54 },
    })

    expect(rejected.past).toHaveLength(1)
    expect(rejected.present.board).toMatchObject({ columns: 30, rows: 20 })
    expect(rejected.present.error).toBe(
      '配置済みの部品または配線が基板外になるため変更できません。',
    )
  })

  it('履歴を上限件数に制限する', () => {
    let state = createEditorHistoryState()

    for (let index = 0; index < EDITOR_HISTORY_LIMIT + 5; index += 1) {
      state = reduce(state, {
        type: 'change-board',
        board: {
          columns: 31 + index,
          rows: 20,
          pitchMm: 2.54,
        },
      })
    }

    expect(state.past).toHaveLength(EDITOR_HISTORY_LIMIT)

    for (let index = 0; index < EDITOR_HISTORY_LIMIT; index += 1) {
      state = reduce(state, { type: 'undo' })
    }

    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(EDITOR_HISTORY_LIMIT)
    expect(state.present.board.columns).toBe(35)
  })

  it('複数回連続したUndo・Redoで順序とIDを維持する', () => {
    const first = placePart(createEditorHistoryState(), 'resistor', 'part-1', {
      column: 2,
      row: 2,
    })
    const second = placePart(first, 'led', 'part-2', { column: 6, row: 6 })
    const third = placePart(second, 'diode', 'part-3', {
      column: 10,
      row: 10,
    })
    const undoneOnce = reduce(third, { type: 'undo' })
    const undoneTwice = reduce(undoneOnce, { type: 'undo' })
    const undoneThreeTimes = reduce(undoneTwice, { type: 'undo' })
    const redoneOnce = reduce(undoneThreeTimes, { type: 'redo' })
    const redoneTwice = reduce(redoneOnce, { type: 'redo' })
    const redoneThreeTimes = reduce(redoneTwice, { type: 'redo' })

    expect(undoneThreeTimes.present.parts).toHaveLength(0)
    expect(redoneThreeTimes.present.parts.map((part) => part.id)).toEqual([
      'part-1',
      'part-2',
      'part-3',
    ])
  })

  it('ネットの作成、変更、削除と関連割り当てをUndo・Redoする', () => {
    const partAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'part-1',
      { column: 2, row: 2 },
    )
    const netCreated = reduce(partAdded, {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA',
      kind: 'signal',
    })
    const assigned = reduce(netCreated, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const changed = reduce(assigned, {
      type: 'update-net',
      netId: 'net-1',
      name: 'VCC',
      kind: 'power',
      color: '#ff0000',
    })
    const deleted = reduce(changed, { type: 'delete-net', netId: 'net-1' })
    const deletionUndone = reduce(deleted, { type: 'undo' })
    const changeUndone = reduce(deletionUndone, { type: 'undo' })
    const assignmentUndone = reduce(changeUndone, { type: 'undo' })
    const assignmentRedone = reduce(assignmentUndone, { type: 'redo' })

    expect(deleted.present.nets).toEqual([])
    expect(deleted.present.pinNetAssignments).toEqual([])
    expect(deletionUndone.present.nets[0]).toEqual({
      id: 'net-1',
      name: 'VCC',
      kind: 'power',
      color: '#ff0000',
    })
    expect(deletionUndone.present.pinNetAssignments).toHaveLength(1)
    expect(changeUndone.present.nets[0]).toMatchObject({
      name: 'DATA',
      kind: 'signal',
    })
    expect(assignmentUndone.present.pinNetAssignments).toEqual([])
    expect(assignmentRedone.present.pinNetAssignments).toEqual([
      { partId: 'part-1', pinNumber: '1', netId: 'net-1' },
    ])
  })

  it('部品削除に伴う割り当て削除を同じUndoで復元する', () => {
    const partAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'part-1',
      { column: 2, row: 2 },
    )
    const withNet = reduce(partAdded, {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA',
      kind: 'signal',
    })
    const assigned = reduce(withNet, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const deleted = reduce(assigned, { type: 'delete-selected-part' })
    const restored = reduce(deleted, { type: 'undo' })

    expect(deleted.present.parts).toEqual([])
    expect(deleted.present.pinNetAssignments).toEqual([])
    expect(restored.present.parts[0].id).toBe('part-1')
    expect(restored.present.pinNetAssignments).toEqual([
      { partId: 'part-1', pinNumber: '1', netId: 'net-1' },
    ])
  })

  it('端子数減少で消える端子の割り当てだけを削除しUndoで復元する', () => {
    const dipAdded = placePart(createEditorHistoryState(), 'dip', 'dip-1', {
      column: 5,
      row: 5,
    })
    const expanded = reduce(dipAdded, {
      type: 'change-selected-dip-pin-count',
      pinCount: 14,
      board: dipAdded.present.board,
    })
    const withNet = reduce(expanded, {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA',
      kind: 'signal',
    })
    const pinOneAssigned = reduce(withNet, {
      type: 'assign-pin-net',
      partId: 'dip-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const pinFourteenAssigned = reduce(pinOneAssigned, {
      type: 'assign-pin-net',
      partId: 'dip-1',
      pinNumber: '14',
      netId: 'net-1',
    })
    const shrunk = reduce(pinFourteenAssigned, {
      type: 'change-selected-dip-pin-count',
      pinCount: 8,
      board: pinFourteenAssigned.present.board,
    })
    const restored = reduce(shrunk, { type: 'undo' })

    expect(shrunk.present.pinNetAssignments).toEqual([
      { partId: 'dip-1', pinNumber: '1', netId: 'net-1' },
    ])
    expect(restored.present.pinNetAssignments).toEqual([
      { partId: 'dip-1', pinNumber: '1', netId: 'net-1' },
      { partId: 'dip-1', pinNumber: '14', netId: 'net-1' },
    ])
  })

  it('失敗したネット操作を履歴へ追加しない', () => {
    const created = reduce(createEditorHistoryState(), {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA',
      kind: 'signal',
    })
    const rejected = reduce(created, {
      type: 'create-net',
      id: 'net-2',
      name: ' data ',
      kind: 'signal',
    })

    expect(rejected.past).toHaveLength(1)
    expect(rejected.present.nets).toBe(created.present.nets)
    expect(rejected.present.error).toBe(
      '同じネット名がすでに使用されています。',
    )
  })

  it('端子のネット変更と割り当て解除をそれぞれ1回でUndoする', () => {
    const partAdded = placePart(
      createEditorHistoryState(),
      'resistor',
      'part-1',
      { column: 2, row: 2 },
    )
    const firstNet = reduce(partAdded, {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA_A',
      kind: 'signal',
    })
    const secondNet = reduce(firstNet, {
      type: 'create-net',
      id: 'net-2',
      name: 'DATA_B',
      kind: 'signal',
    })
    const assigned = reduce(secondNet, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
      netId: 'net-1',
    })
    const changed = reduce(assigned, {
      type: 'assign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
      netId: 'net-2',
    })
    const unassigned = reduce(changed, {
      type: 'unassign-pin-net',
      partId: 'part-1',
      pinNumber: '1',
    })
    const unassignUndone = reduce(unassigned, { type: 'undo' })
    const changeUndone = reduce(unassignUndone, { type: 'undo' })

    expect(changed.present.pinNetAssignments).toEqual([
      { partId: 'part-1', pinNumber: '1', netId: 'net-2' },
    ])
    expect(unassigned.present.pinNetAssignments).toEqual([])
    expect(unassignUndone.present.pinNetAssignments[0].netId).toBe('net-2')
    expect(changeUndone.present.pinNetAssignments[0].netId).toBe('net-1')
  })
})
