import {
  editorReducer,
  INITIAL_EDITOR_STATE,
  type EditorAction,
  type EditorDesignState,
  type EditorState,
} from './editorStore'

export const EDITOR_HISTORY_LIMIT = 100

export type EditorHistoryState = {
  past: EditorDesignState[]
  present: EditorState
  future: EditorDesignState[]
}

export type EditorHistoryAction =
  | EditorAction
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace-design'; design: EditorDesignState }

type HistoryShortcutInput = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export type EditorKeyboardShortcut =
  | 'select-tool'
  | 'wire-front-tool'
  | 'wire-back-tool'
  | 'wire-back-jumper-tool'
  | 'rotate-selected-part'
  | 'delete-selected'

export function getHistoryShortcutAction(
  input: HistoryShortcutInput,
): 'undo' | 'redo' | null {
  if (
    input.altKey ||
    (!input.metaKey && !input.ctrlKey) ||
    input.key.toLocaleLowerCase() !== 'z'
  ) {
    return null
  }

  return input.shiftKey ? 'redo' : 'undo'
}

export function getEditorKeyboardShortcut(
  input: HistoryShortcutInput,
): EditorKeyboardShortcut | null {
  if (input.altKey || input.metaKey || input.ctrlKey) {
    return null
  }

  switch (input.key.toLocaleLowerCase()) {
    case 'v':
      return 'select-tool'
    case 'f':
      return 'wire-front-tool'
    case 'b':
      return 'wire-back-tool'
    case 'j':
      return 'wire-back-jumper-tool'
    case 'r':
      return 'rotate-selected-part'
    case 'delete':
    case 'backspace':
      return 'delete-selected'
    default:
      return null
  }
}

export function getEditorDesignState(state: EditorState): EditorDesignState {
  return {
    metadata: state.metadata,
    board: state.board,
    parts: state.parts,
    wires: state.wires,
    nets: state.nets,
    pinNetAssignments: state.pinNetAssignments,
  }
}

export function createEditorHistoryState(
  present: EditorState = INITIAL_EDITOR_STATE,
): EditorHistoryState {
  return {
    past: [],
    present,
    future: [],
  }
}

export const INITIAL_EDITOR_HISTORY_STATE = createEditorHistoryState()

export function canUndo(state: EditorHistoryState): boolean {
  return state.past.length > 0
}

export function canRedo(state: EditorHistoryState): boolean {
  return state.future.length > 0
}

function didDesignChange(previous: EditorState, next: EditorState): boolean {
  return (
    previous.metadata !== next.metadata ||
    previous.board !== next.board ||
    previous.parts !== next.parts ||
    previous.wires !== next.wires ||
    previous.nets !== next.nets ||
    previous.pinNetAssignments !== next.pinNetAssignments
  )
}

function createEditorStateFromDesign(design: EditorDesignState): EditorState {
  return {
    ...INITIAL_EDITOR_STATE,
    metadata: { ...design.metadata },
    board: { ...design.board },
    parts: design.parts,
    wires: design.wires,
    nets: design.nets,
    pinNetAssignments: design.pinNetAssignments,
  }
}

function restoreDesignState(
  current: EditorState,
  design: EditorDesignState,
): EditorState {
  const selectedPartId =
    current.selectedPartId !== null &&
    design.parts.some((part) => part.id === current.selectedPartId)
      ? current.selectedPartId
      : null
  const selectedWireId =
    current.selectedWireId !== null &&
    design.wires.some((wire) => wire.id === current.selectedWireId)
      ? current.selectedWireId
      : null

  return {
    ...current,
    ...design,
    selectedPartId,
    selectedWireId,
    placement: null,
    wireDraft: null,
    error: null,
  }
}

export function editorHistoryReducer(
  state: EditorHistoryState,
  action: EditorHistoryAction,
): EditorHistoryState {
  if (action.type === 'replace-design') {
    return createEditorHistoryState(createEditorStateFromDesign(action.design))
  }

  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1]

    if (previous === undefined) {
      return state
    }

    return {
      past: state.past.slice(0, -1),
      present: restoreDesignState(state.present, previous),
      future: [getEditorDesignState(state.present), ...state.future].slice(
        0,
        EDITOR_HISTORY_LIMIT,
      ),
    }
  }

  if (action.type === 'redo') {
    const next = state.future[0]

    if (next === undefined) {
      return state
    }

    return {
      past: [...state.past, getEditorDesignState(state.present)].slice(
        -EDITOR_HISTORY_LIMIT,
      ),
      present: restoreDesignState(state.present, next),
      future: state.future.slice(1),
    }
  }

  const nextPresent = editorReducer(state.present, action)

  if (!didDesignChange(state.present, nextPresent)) {
    return { ...state, present: nextPresent }
  }

  return {
    past: [...state.past, getEditorDesignState(state.present)].slice(
      -EDITOR_HISTORY_LIMIT,
    ),
    present: nextPresent,
    future: [],
  }
}
