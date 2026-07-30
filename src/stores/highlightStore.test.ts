import { describe, expect, it } from 'vitest'
import {
  createEmptyDesignState,
  getDesignFingerprint,
} from '../domain/designDocument'
import { highlightReducer, INITIAL_HIGHLIGHT_STATE } from './highlightStore'

describe('highlightStore', () => {
  it('ネットと問題の再選択で強調を切り替え、解除できる', () => {
    const netSelected = highlightReducer(INITIAL_HIGHLIGHT_STATE, {
      type: 'toggle-net',
      netId: 'net-1',
    })
    const issueSelected = highlightReducer(netSelected, {
      type: 'toggle-issue',
      issueKey: 'issue-1',
    })
    const issueDeselected = highlightReducer(issueSelected, {
      type: 'toggle-issue',
      issueKey: 'issue-1',
    })
    const cleared = highlightReducer(netSelected, { type: 'clear' })

    expect(netSelected).toEqual({
      selectedNetId: 'net-1',
      selectedIssueKey: null,
    })
    expect(issueSelected).toEqual({
      selectedNetId: null,
      selectedIssueKey: 'issue-1',
    })
    expect(issueDeselected).toEqual(INITIAL_HIGHLIGHT_STATE)
    expect(cleared).toEqual(INITIAL_HIGHLIGHT_STATE)
  })

  it('強調状態を設計データへ含めず未保存判定用指紋へ影響させない', () => {
    const design = createEmptyDesignState()
    const fingerprint = getDesignFingerprint(design)

    highlightReducer(INITIAL_HIGHLIGHT_STATE, {
      type: 'toggle-net',
      netId: 'net-1',
    })

    expect(getDesignFingerprint(design)).toBe(fingerprint)
    expect(design).not.toHaveProperty('selectedNetId')
    expect(design).not.toHaveProperty('selectedIssueKey')
  })
})
