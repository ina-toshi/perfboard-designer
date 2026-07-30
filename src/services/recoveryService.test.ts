import { describe, expect, it } from 'vitest'
import { createEmptyDesignState } from '../domain/designDocument'
import {
  createRecoveryData,
  detectRecoveryData,
  discardRecoveryData,
  type RecoveryStorage,
} from './recoveryService'

function createMemoryStorage() {
  let contents: string | null = null
  const storage: RecoveryStorage = {
    read: async () => contents,
    write: async (nextContents) => {
      contents = nextContents
    },
    delete: async () => {
      contents = null
    },
  }

  return { storage, readContents: () => contents }
}

describe('recoveryService', () => {
  it('復旧用データを作成して検出する', async () => {
    const memory = createMemoryStorage()
    const design = {
      ...createEmptyDesignState(),
      metadata: { name: '復旧対象' },
      nets: [{ id: 'net-1', name: 'DATA', kind: 'signal' as const }],
    }

    await createRecoveryData(memory.storage, design, '2026-07-26T08:00:00.000Z')
    const detected = await detectRecoveryData(memory.storage)

    expect(memory.readContents()).toContain('"recoveryVersion": 1')
    expect(memory.readContents()).toContain('"formatVersion": 0')
    expect(memory.readContents()).toContain('"name": "DATA"')
    expect(detected).toEqual({
      savedAt: '2026-07-26T08:00:00.000Z',
      design,
    })
  })

  it('復旧用データを破棄する', async () => {
    const memory = createMemoryStorage()

    await createRecoveryData(memory.storage, createEmptyDesignState())
    await discardRecoveryData(memory.storage)

    expect(await detectRecoveryData(memory.storage)).toBeNull()
  })

  it('壊れた復旧用データを拒否する', async () => {
    const storage: RecoveryStorage = {
      read: async () => '{"recoveryVersion":',
      write: async () => undefined,
      delete: async () => undefined,
    }

    await expect(detectRecoveryData(storage)).rejects.toThrow(
      '復旧データのJSONが壊れています。',
    )
  })
})
