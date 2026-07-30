import { describe, expect, it } from 'vitest'
import {
  createEmptyDesignState,
  getDesignFingerprint,
} from '../domain/designDocument'
import { createPart } from '../domain/parts'
import {
  createEditorHistoryState,
  editorHistoryReducer,
  getEditorDesignState,
} from './editorHistory'
import {
  createProjectFileState,
  isProjectDirty,
  loadDesignSafely,
  projectFileReducer,
} from './projectStore'

describe('projectStore', () => {
  it('新規作成直後と保存直後は未保存ではない', () => {
    const design = createEmptyDesignState()
    const initial = createProjectFileState(design)
    const saved = projectFileReducer(initial, {
      type: 'mark-saved',
      filePath: 'sample.perfboard.json',
      fingerprint: getDesignFingerprint(design),
    })

    expect(isProjectDirty(initial, design)).toBe(false)
    expect(isProjectDirty(saved, design)).toBe(false)
  })

  it('保存後の編集で未保存になり、保存状態までUndoすると保存済みに戻る', () => {
    const initialHistory = createEditorHistoryState()
    const placing = editorHistoryReducer(initialHistory, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const added = editorHistoryReducer(placing, {
      type: 'commit-placement',
      board: placing.present.board,
      id: 'part-1',
      origin: { column: 3, row: 3 },
    })
    const savedDesign = getEditorDesignState(added.present)
    const savedProject = projectFileReducer(
      createProjectFileState(createEmptyDesignState()),
      {
        type: 'mark-saved',
        filePath: 'sample.perfboard.json',
        fingerprint: getDesignFingerprint(savedDesign),
      },
    )
    const rotated = editorHistoryReducer(added, {
      type: 'rotate-selected-part',
      board: added.present.board,
    })
    const undone = editorHistoryReducer(rotated, { type: 'undo' })

    expect(
      isProjectDirty(savedProject, getEditorDesignState(rotated.present)),
    ).toBe(true)
    expect(
      isProjectDirty(savedProject, getEditorDesignState(undone.present)),
    ).toBe(false)
  })

  it('保存状態へUndoした後の新規編集でRedoを破棄し、未保存になる', () => {
    const initial = createEditorHistoryState()
    const placing = editorHistoryReducer(initial, {
      type: 'begin-new-part',
      kind: 'resistor',
    })
    const savedHistory = editorHistoryReducer(placing, {
      type: 'commit-placement',
      board: placing.present.board,
      id: 'part-1',
      origin: { column: 3, row: 3 },
    })
    const savedDesign = getEditorDesignState(savedHistory.present)
    const project = projectFileReducer(
      createProjectFileState(createEmptyDesignState()),
      {
        type: 'mark-saved',
        filePath: 'sample.perfboard.json',
        fingerprint: getDesignFingerprint(savedDesign),
      },
    )
    const rotated = editorHistoryReducer(savedHistory, {
      type: 'rotate-selected-part',
      board: savedHistory.present.board,
    })
    const backAtSavedState = editorHistoryReducer(rotated, { type: 'undo' })
    const placingNewPart = editorHistoryReducer(backAtSavedState, {
      type: 'begin-new-part',
      kind: 'led',
    })
    const branched = editorHistoryReducer(placingNewPart, {
      type: 'commit-placement',
      board: placingNewPart.present.board,
      id: 'part-2',
      origin: { column: 8, row: 8 },
    })

    expect(
      isProjectDirty(project, getEditorDesignState(backAtSavedState.present)),
    ).toBe(false)
    expect(branched.future).toHaveLength(0)
    expect(
      isProjectDirty(project, getEditorDesignState(branched.present)),
    ).toBe(true)
  })

  it('読み込み失敗後も現在の設計と履歴を同じ参照で保持する', () => {
    const history = createEditorHistoryState({
      ...createEditorHistoryState().present,
      parts: [createPart('resistor', 'part-1', 'R1', { column: 2, row: 2 })],
    })
    const result = loadDesignSafely(history, '{"formatVersion":')

    expect(result.ok).toBe(false)
    expect(result.history).toBe(history)
    expect(result.history.present.parts[0].id).toBe('part-1')
  })

  it('正常な読み込みと新規設計への置換で履歴を初期化する', () => {
    const edited = editorHistoryReducer(createEditorHistoryState(), {
      type: 'change-design-name',
      name: '編集中',
    })
    const loadedDesign = {
      ...createEmptyDesignState(),
      metadata: { name: '読込済み' },
    }
    const loaded = editorHistoryReducer(edited, {
      type: 'replace-design',
      design: loadedDesign,
    })
    const reset = editorHistoryReducer(loaded, {
      type: 'replace-design',
      design: createEmptyDesignState(),
    })

    expect(loaded.past).toHaveLength(0)
    expect(loaded.future).toHaveLength(0)
    expect(loaded.present.metadata.name).toBe('読込済み')
    expect(reset.past).toHaveLength(0)
    expect(reset.present.metadata.name).toBe('名称未設定')
  })

  it('ネットと端子割り当てを未保存判定の対象にする', () => {
    const initial = createEditorHistoryState()
    const project = createProjectFileState(
      getEditorDesignState(initial.present),
    )
    const withNet = editorHistoryReducer(initial, {
      type: 'create-net',
      id: 'net-1',
      name: 'DATA',
      kind: 'signal',
    })
    const restored = editorHistoryReducer(withNet, { type: 'undo' })

    expect(isProjectDirty(project, getEditorDesignState(withNet.present))).toBe(
      true,
    )
    expect(
      isProjectDirty(project, getEditorDesignState(restored.present)),
    ).toBe(false)
  })
})
