import {
  parseRecoveryDraft,
  serializeRecoveryDraft,
  type RecoveryDraft,
} from '../domain/recoveryDocument'
import type { EditorDesignState } from '../stores/editorStore'

export type RecoveryStorage = {
  read: () => Promise<string | null>
  write: (contents: string) => Promise<void>
  delete: () => Promise<void>
}

export async function createRecoveryData(
  storage: RecoveryStorage,
  design: EditorDesignState,
  savedAt?: string,
): Promise<void> {
  await storage.write(serializeRecoveryDraft(design, savedAt))
}

export async function detectRecoveryData(
  storage: RecoveryStorage,
): Promise<RecoveryDraft | null> {
  const contents = await storage.read()
  return contents === null ? null : parseRecoveryDraft(contents)
}

export async function discardRecoveryData(
  storage: RecoveryStorage,
): Promise<void> {
  await storage.delete()
}
