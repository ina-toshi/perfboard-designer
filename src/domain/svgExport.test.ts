import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import {
  createPart,
  withLedColor,
  withPinHeaderGender,
  type LedPart,
  type PinHeaderPart,
} from './parts'
import {
  escapeXml,
  generateAssemblySvg,
  getSvgExportMetrics,
  type SvgExportDesign,
} from './svgExport'
import { createWire } from './wires'

const TEST_BOARD: Board = {
  columns: 5,
  rows: 4,
  pitchMm: 2.54,
}

function createTestDesign(): SvgExportDesign {
  const resistor = createPart('resistor', 'part-1', 'R1', { column: 0, row: 0 })
  const diode = createPart('diode', 'part-2', 'D1', { column: 0, row: 2 })
  const tactileSwitch = createPart('tactile-switch', 'part-3', 'SW1', {
    column: 3,
    row: 2,
  })

  return {
    metadata: { name: '組み立て確認' },
    board: TEST_BOARD,
    parts: [resistor, diode, tactileSwitch],
    wires: [
      createWire(
        'front-wire',
        'front',
        { column: 0, row: 0 },
        { column: 3, row: 0 },
        '#2563eb',
      ),
      createWire(
        'back-wire',
        'back',
        { column: 0, row: 2 },
        { column: 3, row: 2 },
        '#d92d20',
      ),
      createWire(
        'back-jumper-wire',
        'back',
        { column: 0, row: 3 },
        { column: 3, row: 3 },
        '#2563eb',
        'jumper',
      ),
    ],
  }
}

function rounded(value: number): number {
  return Number(value.toFixed(3))
}

describe('assembly SVG export', () => {
  it('表面図へ部品、端子、表面配線だけを出力する', () => {
    const svg = generateAssemblySvg(createTestDesign(), {
      side: 'front',
      mirrorBack: true,
    })

    expect(svg).toContain('表面・部品面')
    expect(svg).toContain('class="front-wires"')
    expect(svg).toContain('#2563eb')
    expect(svg).not.toContain('#d92d20')
    expect(svg).toContain('class="front-components"')
    expect(svg).toContain('class="part-pin"')
    expect(svg).toContain('R1')
    expect(svg).toContain('class="part-body tactile-switch"')
    expect(svg).toContain('SW1')
  })

  it('裏面図へ薄い部品外形、端子、裏面配線だけを出力する', () => {
    const svg = generateAssemblySvg(createTestDesign(), {
      side: 'back',
      mirrorBack: false,
    })

    expect(svg).toContain('裏面・はんだ面')
    expect(svg).toContain('左右反転なし（表面と同じ列方向）')
    expect(svg).toContain('class="back-wires"')
    expect(svg).toContain('#d92d20')
    expect(svg).toContain('#2563eb')
    expect(svg).toContain('class="wire wire-back wire-jumper"')
    expect(svg).toContain('class="component-outline"')
    expect(svg).toContain('class="part-pin"')
  })

  it('オスとメスのピンヘッダーを異なる記号で出力する', () => {
    const male = createPart('pin-header', 'male-header', 'J1', {
      column: 0,
      row: 0,
    })
    const female = withPinHeaderGender(
      createPart('pin-header', 'female-header', 'J2', {
        column: 2,
        row: 0,
      }) as PinHeaderPart,
      'female',
    )
    const svg = generateAssemblySvg(
      {
        metadata: { name: 'ヘッダー種別' },
        board: TEST_BOARD,
        parts: [male, female],
        wires: [],
      },
      { side: 'front', mirrorBack: false },
    )

    expect(svg).toContain('pin-header-male')
    expect(svg).toContain('pin-header-female')
    expect(svg).toContain('pin-header-male-pin')
    expect(svg).toContain('pin-header-male-pin-tip')
    expect(svg).toContain('pin-header-female-socket')
    expect(svg).toContain('pin-header-female-opening')
    expect(svg).toContain('fill: #466273')
    expect(svg).toContain('>オス・ピン</text>')
    expect(svg).toContain('>メス・ソケット</text>')
  })

  it('LEDの発光色を出力する', () => {
    const led = withLedColor(
      createPart('led', 'led-1', 'LED1', { column: 0, row: 0 }) as LedPart,
      'green',
    )
    const svg = generateAssemblySvg(
      {
        metadata: { name: 'LED色' },
        board: TEST_BOARD,
        parts: [led],
        wires: [],
      },
      { side: 'front', mirrorBack: false },
    )

    expect(svg).toContain('fill="#22c55e"')
    expect(svg).toContain('r="1.45"')
  })

  it('裏面反転の有無を座標へ反映し、設計座標は変更しない', () => {
    const design = createTestDesign()
    const before = structuredClone(design)
    const metrics = getSvgExportMetrics(TEST_BOARD)
    const unmirrored = generateAssemblySvg(design, {
      side: 'back',
      mirrorBack: false,
    })
    const mirrored = generateAssemblySvg(design, {
      side: 'back',
      mirrorBack: true,
    })
    const leftX = rounded(metrics.gridOriginX)
    const mirroredX = rounded(
      metrics.gridOriginX + (TEST_BOARD.columns - 1) * TEST_BOARD.pitchMm,
    )
    const wireY = rounded(metrics.gridOriginY + TEST_BOARD.pitchMm * 2)

    expect(unmirrored).toContain(`M ${leftX} ${wireY}`)
    expect(mirrored).toContain(`M ${mirroredX} ${wireY}`)
    expect(mirrored).toContain('左右反転あり（はんだ面から見た向き）')
    expect(design).toEqual(before)
  })

  it('部品の回転済み端子位置を出力へ再利用する', () => {
    const resistor = createPart('resistor', 'rotated-resistor', 'R90', {
      column: 2,
      row: 0,
    })
    resistor.rotation = 90
    const design: SvgExportDesign = {
      metadata: { name: '回転確認' },
      board: TEST_BOARD,
      parts: [resistor],
      wires: [],
    }
    const metrics = getSvgExportMetrics(TEST_BOARD)
    const x = rounded(metrics.gridOriginX + TEST_BOARD.pitchMm * 2)

    const svg = generateAssemblySvg(design, {
      side: 'front',
      mirrorBack: false,
    })

    expect(svg).toContain(
      `transform="translate(${x} ${metrics.gridOriginY}) rotate(90)"`,
    )
    expect(svg).toContain('x2="10.16"')
  })

  it('実寸mm、2.54mm穴間隔、10mmスケールと印刷注意を含める', () => {
    const metrics = getSvgExportMetrics(TEST_BOARD)
    const svg = generateAssemblySvg(createTestDesign(), {
      side: 'front',
      mirrorBack: false,
    })
    const firstHoleX = metrics.gridOriginX
    const secondHoleX = metrics.gridOriginX + TEST_BOARD.pitchMm

    expect(svg).toContain(`width="${metrics.widthMm}mm"`)
    expect(svg).toContain(`height="${metrics.heightMm}mm"`)
    expect(svg).toContain(
      `class="board-hole" cx="${firstHoleX}" cy="${metrics.gridOriginY}"`,
    )
    expect(svg).toContain(
      `class="board-hole" cx="${secondHoleX}" cy="${metrics.gridOriginY}"`,
    )
    expect(svg).toContain('class="ten-mm-scale"')
    expect(svg).toContain('確認用 10mm')
    expect(svg).toContain('印刷時は拡大縮小なし・100%')
  })

  it('日本語を保持し、XML特殊文字をすべてエスケープする', () => {
    const design = createTestDesign()
    design.metadata.name = `日本語<&"'設計`
    design.parts[0].reference = `R<&"'1`
    design.parts[0].value = `値<&"'`

    const svg = generateAssemblySvg(design, {
      side: 'front',
      mirrorBack: false,
    })

    expect(svg).toContain('日本語')
    expect(svg).toContain('日本語&lt;&amp;&quot;&apos;設計')
    expect(svg).toContain('R&lt;&amp;&quot;&apos;1')
    expect(svg).toContain('値&lt;&amp;&quot;&apos;')
    expect(svg).not.toContain(`日本語<&"'設計`)
    expect(escapeXml(`< > & " '`)).toBe('&lt; &gt; &amp; &quot; &apos;')
  })

  it('編集専用の選択・クリック判定・プレビュー要素を含めない', () => {
    const svg = generateAssemblySvg(createTestDesign(), {
      side: 'front',
      mirrorBack: false,
    })

    expect(svg).not.toContain('is-selected')
    expect(svg).not.toContain('hit-target')
    expect(svg).not.toContain('preview')
    expect(svg).not.toContain('wire-draft')
    expect(svg).not.toContain('data-layer="selection"')
  })

  it('部品ラベルを非表示にしたSVGを出力する', () => {
    const svg = generateAssemblySvg(createTestDesign(), {
      side: 'front',
      mirrorBack: false,
      showPartLabels: false,
    })

    expect(svg).toContain(
      '.part-reference, .part-value, .pin-header-gender { display: none; }',
    )
  })
})
