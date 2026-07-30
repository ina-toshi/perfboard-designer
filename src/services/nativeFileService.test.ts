import { describe, expect, it } from 'vitest'
import {
  createDefaultFileName,
  createSvgExportFileName,
  ensureDesignExtension,
  ensureSvgExtension,
  sanitizeExportBaseName,
} from './nativeFileService'

describe('nativeFileService helpers', () => {
  it('推奨拡張子を重複なく付ける', () => {
    expect(ensureDesignExtension('design')).toBe('design.perfboard.json')
    expect(ensureDesignExtension('design.perfboard.json')).toBe(
      'design.perfboard.json',
    )
  })

  it('設計名から安全な初期ファイル名を作る', () => {
    expect(createDefaultFileName('電源/制御:基板')).toBe(
      '電源-制御-基板.perfboard.json',
    )
  })

  it('SVG拡張子を重複なく付ける', () => {
    expect(ensureSvgExtension('assembly')).toBe('assembly.svg')
    expect(ensureSvgExtension('assembly.SVG')).toBe('assembly.SVG')
  })

  it('設計名を安全化し、面と裏面反転状態が分かるSVG名を作る', () => {
    expect(createSvgExportFileName('sample', 'front', true)).toBe(
      'sample-front.svg',
    )
    expect(createSvgExportFileName('sample', 'back', true)).toBe(
      'sample-back-mirrored.svg',
    )
    expect(createSvgExportFileName('sample', 'back', false)).toBe(
      'sample-back-unmirrored.svg',
    )
    expect(createSvgExportFileName('電源/制御:*基板.', 'front', false)).toBe(
      '電源-制御-基板-front.svg',
    )
  })

  it('空名、制御文字、予約名を安全なベース名へ置き換える', () => {
    expect(sanitizeExportBaseName(' .. ')).toBe('名称未設定')
    expect(sanitizeExportBaseName('CON')).toBe('design-CON')
    expect(sanitizeExportBaseName(' 制御\u0000基板 ')).toBe('制御-基板')
  })
})
