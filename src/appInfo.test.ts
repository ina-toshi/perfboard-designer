import { describe, expect, it } from 'vitest'
import { appInfo } from './appInfo'

describe('appInfo', () => {
  it('アプリケーション名を定義している', () => {
    expect(appInfo.name).toBe('Perfboard Designer')
  })
})
