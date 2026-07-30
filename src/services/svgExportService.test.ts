import { describe, expect, it, vi } from 'vitest'
import { createPart } from '../domain/parts'
import { createWire } from '../domain/wires'
import type { EditorHistoryState } from '../stores/editorHistory'
import {
  createEditorHistoryState,
  getEditorDesignState,
} from '../stores/editorHistory'
import { INITIAL_EDITOR_STATE } from '../stores/editorStore'
import { exportAssemblySvg, type SvgExportStorage } from './svgExportService'

function createHistory(): EditorHistoryState {
  const part = createPart('resistor', 'part-1', 'R1', { column: 1, row: 1 })
  const wire = createWire(
    'wire-1',
    'front',
    { column: 1, row: 1 },
    { column: 4, row: 1 },
  )

  return createEditorHistoryState({
    ...INITIAL_EDITOR_STATE,
    metadata: { name: '出力テスト' },
    parts: [part],
    wires: [wire],
    nets: [
      {
        id: 'net-do-not-export',
        name: 'DATA_NET_DO_NOT_EXPORT',
        kind: 'signal',
      },
    ],
    pinNetAssignments: [
      {
        partId: part.id,
        pinNumber: '1',
        netId: 'net-do-not-export',
      },
    ],
    selectedPartId: part.id,
  })
}

describe('svgExportService', () => {
  it('選択したパスへUTF-8 SVGを書き出す', async () => {
    const history = createHistory()
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const storage: SvgExportStorage = {
      chooseFile: vi.fn().mockResolvedValue('assembly-front.svg'),
      writeFile,
    }

    const result = await exportAssemblySvg(
      getEditorDesignState(history.present),
      { side: 'front', mirrorBack: true },
      storage,
    )

    expect(result).toBe('assembly-front.svg')
    expect(writeFile).toHaveBeenCalledOnce()
    expect(writeFile.mock.calls[0][1]).toContain('encoding="UTF-8"')
    expect(writeFile.mock.calls[0][1]).toContain('表面・部品面')
    expect(writeFile.mock.calls[0][1]).not.toContain('DATA_NET_DO_NOT_EXPORT')
    expect(writeFile.mock.calls[0][1]).not.toContain('net-do-not-export')
  })

  it('ダイアログを中止した場合はファイルを書かない', async () => {
    const history = createHistory()
    const writeFile = vi.fn()
    const storage: SvgExportStorage = {
      chooseFile: vi.fn().mockResolvedValue(null),
      writeFile,
    }

    await expect(
      exportAssemblySvg(
        getEditorDesignState(history.present),
        { side: 'back', mirrorBack: true },
        storage,
      ),
    ).resolves.toBeNull()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('出力前後で設計、選択、未保存判定用履歴を変更しない', async () => {
    const history = createHistory()
    const before = structuredClone(history)
    const storage: SvgExportStorage = {
      chooseFile: vi.fn().mockResolvedValue('assembly-back.svg'),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }

    await exportAssemblySvg(
      getEditorDesignState(history.present),
      { side: 'back', mirrorBack: false },
      storage,
    )

    expect(history).toEqual(before)
  })
})
