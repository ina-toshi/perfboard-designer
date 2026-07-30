import {
  getDesignFingerprint,
  parseDesignDocument,
} from '../domain/designDocument'
import { editorHistoryReducer, type EditorHistoryState } from './editorHistory'
import type { EditorDesignState } from './editorStore'

export type ProjectOperation =
  'idle' | 'checking-recovery' | 'recovering' | 'opening' | 'saving'

export type ProjectFileState = {
  filePath: string | null
  savedFingerprint: string | null
  operation: ProjectOperation
  message: string | null
  error: string | null
}

export type ProjectFileAction =
  | { type: 'start-operation'; operation: Exclude<ProjectOperation, 'idle'> }
  | { type: 'cancel-operation' }
  | {
      type: 'mark-saved'
      filePath: string
      fingerprint: string
    }
  | {
      type: 'mark-opened'
      filePath: string
      fingerprint: string
    }
  | { type: 'mark-new'; fingerprint: string }
  | { type: 'mark-recovered' }
  | { type: 'fail-operation'; error: string }
  | { type: 'set-message'; message: string }
  | { type: 'clear-feedback' }

export function createProjectFileState(
  design: EditorDesignState,
): ProjectFileState {
  return {
    filePath: null,
    savedFingerprint: getDesignFingerprint(design),
    operation: 'idle',
    message: null,
    error: null,
  }
}

export function projectFileReducer(
  state: ProjectFileState,
  action: ProjectFileAction,
): ProjectFileState {
  switch (action.type) {
    case 'start-operation':
      return {
        ...state,
        operation: action.operation,
        message: null,
        error: null,
      }
    case 'cancel-operation':
      return { ...state, operation: 'idle' }
    case 'mark-saved':
      return {
        filePath: action.filePath,
        savedFingerprint: action.fingerprint,
        operation: 'idle',
        message: '設計ファイルを保存しました。',
        error: null,
      }
    case 'mark-opened':
      return {
        filePath: action.filePath,
        savedFingerprint: action.fingerprint,
        operation: 'idle',
        message: '設計ファイルを開きました。',
        error: null,
      }
    case 'mark-new':
      return {
        filePath: null,
        savedFingerprint: action.fingerprint,
        operation: 'idle',
        message: '新しい設計を作成しました。',
        error: null,
      }
    case 'mark-recovered':
      return {
        filePath: null,
        savedFingerprint: null,
        operation: 'idle',
        message: '復旧データを復元しました。保存先は未設定です。',
        error: null,
      }
    case 'fail-operation':
      return {
        ...state,
        operation: 'idle',
        message: null,
        error: action.error,
      }
    case 'set-message':
      return {
        ...state,
        operation: 'idle',
        message: action.message,
        error: null,
      }
    case 'clear-feedback':
      return { ...state, message: null, error: null }
  }
}

export function isProjectDirty(
  state: ProjectFileState,
  design: EditorDesignState,
): boolean {
  return (
    state.savedFingerprint === null ||
    state.savedFingerprint !== getDesignFingerprint(design)
  )
}

export function getProjectOperationLabel(
  operation: ProjectOperation,
): string | null {
  switch (operation) {
    case 'idle':
      return null
    case 'checking-recovery':
      return '復旧データを確認中です…'
    case 'recovering':
      return '復旧データを復元中です…'
    case 'opening':
      return '設計ファイルを読み込み中です…'
    case 'saving':
      return '設計ファイルを保存中です…'
  }
}

export function getFileName(filePath: string | null): string {
  if (filePath === null) {
    return '保存先未設定'
  }

  return filePath.split(/[\\/]/).pop() ?? filePath
}

export type LoadDesignResult =
  | {
      ok: true
      design: EditorDesignState
      history: EditorHistoryState
    }
  | {
      ok: false
      error: string
      history: EditorHistoryState
    }

export function loadDesignSafely(
  history: EditorHistoryState,
  json: string,
): LoadDesignResult {
  try {
    const design = parseDesignDocument(json)
    return {
      ok: true,
      design,
      history: editorHistoryReducer(history, {
        type: 'replace-design',
        design,
      }),
    }
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error, '設計ファイルを読み込めませんでした。'),
      history,
    }
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }

  return fallback
}
