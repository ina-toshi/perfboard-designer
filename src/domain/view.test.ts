import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOARD_VIEW_STATE,
  shouldMirrorBoard,
  shouldMirrorPart,
  shouldMirrorWire,
  type BoardViewState,
} from './view'

describe('表示面ごとの左右反転', () => {
  const baseView: BoardViewState = {
    displayMode: 'front',
    mirrorBack: true,
    showPartLabels: true,
    zoom: 1,
    pan: { x: 0, y: 0 },
  }

  it('部品ラベルは既定で非表示にする', () => {
    expect(DEFAULT_BOARD_VIEW_STATE.showPartLabels).toBe(false)
  })

  it('表面では左右反転しない', () => {
    expect(shouldMirrorBoard(baseView)).toBe(false)
    expect(shouldMirrorPart(baseView)).toBe(false)
    expect(shouldMirrorWire(baseView, 'front')).toBe(false)
    expect(shouldMirrorWire(baseView, 'back')).toBe(false)
  })

  it('裏面では基板全体を左右反転する', () => {
    const view = { ...baseView, displayMode: 'back' as const }

    expect(shouldMirrorBoard(view)).toBe(true)
    expect(shouldMirrorPart(view)).toBe(true)
    expect(shouldMirrorWire(view, 'front')).toBe(true)
    expect(shouldMirrorWire(view, 'back')).toBe(true)
  })

  it('重ね合わせでは左右反転しない', () => {
    const view = { ...baseView, displayMode: 'overlay' as const }

    expect(shouldMirrorBoard(view)).toBe(false)
    expect(shouldMirrorPart(view)).toBe(false)
    expect(shouldMirrorWire(view, 'front')).toBe(false)
    expect(shouldMirrorWire(view, 'back')).toBe(false)
  })
})
