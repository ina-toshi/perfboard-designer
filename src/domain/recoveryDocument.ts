import {
  createDesignDocument,
  parseDesignDocumentValue,
} from './designDocument'
import type { EditorDesignState } from '../stores/editorStore'

export const RECOVERY_FORMAT_VERSION = 1

export type RecoveryDraft = {
  savedAt: string
  design: EditorDesignState
}

export function serializeRecoveryDraft(
  design: EditorDesignState,
  savedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify(
    {
      recoveryVersion: RECOVERY_FORMAT_VERSION,
      savedAt,
      document: createDesignDocument(design),
    },
    null,
    2,
  )}\n`
}

export function parseRecoveryDraft(json: string): RecoveryDraft {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('復旧データのJSONが壊れています。')
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('復旧データの形式が正しくありません。')
  }

  const source = value as Record<string, unknown>

  if (source.recoveryVersion !== RECOVERY_FORMAT_VERSION) {
    throw new Error(
      `復旧データのバージョン「${String(source.recoveryVersion)}」には対応していません。`,
    )
  }
  if (
    typeof source.savedAt !== 'string' ||
    Number.isNaN(Date.parse(source.savedAt))
  ) {
    throw new Error('復旧データの保存日時が正しくありません。')
  }

  return {
    savedAt: source.savedAt,
    design: parseDesignDocumentValue(source.document),
  }
}
