import type { Board, GridPoint } from './board'
import { getDisplayGridPoint } from './coordinates'
import type { DesignMetadata } from './design'
import {
  getPartPinPositions,
  LED_COLOR_HEX,
  type Part,
  type TactileSwitchPart,
} from './parts'
import { getWireDisplayGridPoints, type Wire, type WireSide } from './wires'

export type AssemblySvgSide = WireSide

export type SvgExportDesign = {
  metadata: DesignMetadata
  board: Board
  parts: Part[]
  wires: Wire[]
}

export type SvgExportOptions = {
  side: AssemblySvgSide
  mirrorBack: boolean
  showPartLabels?: boolean
}

export type SvgExportMetrics = {
  widthMm: number
  heightMm: number
  boardX: number
  boardY: number
  boardWidth: number
  boardHeight: number
  gridOriginX: number
  gridOriginY: number
}

const SIDE_MARGIN_MM = 12
const TOP_MARGIN_MM = 18
const BOTTOM_MARGIN_MM = 22
const BOARD_EDGE_MM = 2.54
const TEN_MM_SCALE_LENGTH = 10

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString()
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function getSvgExportMetrics(board: Board): SvgExportMetrics {
  const boardWidth = (board.columns - 1) * board.pitchMm + BOARD_EDGE_MM * 2
  const boardHeight = (board.rows - 1) * board.pitchMm + BOARD_EDGE_MM * 2

  return {
    widthMm: SIDE_MARGIN_MM * 2 + boardWidth,
    heightMm: TOP_MARGIN_MM + boardHeight + BOTTOM_MARGIN_MM,
    boardX: SIDE_MARGIN_MM,
    boardY: TOP_MARGIN_MM,
    boardWidth,
    boardHeight,
    gridOriginX: SIDE_MARGIN_MM + BOARD_EDGE_MM,
    gridOriginY: TOP_MARGIN_MM + BOARD_EDGE_MM,
  }
}

function pointToSvg(
  point: GridPoint,
  board: Board,
  metrics: SvgExportMetrics,
  mirrorHorizontally: boolean,
) {
  const displayPoint = getDisplayGridPoint(point, board, mirrorHorizontally)

  return {
    x: metrics.gridOriginX + displayPoint.column * board.pitchMm,
    y: metrics.gridOriginY + displayPoint.row * board.pitchMm,
  }
}

function renderLabels(
  part: Part,
  x: number,
  referenceY: number,
  valueY: number,
): string {
  return [
    `<text class="part-reference" x="${formatNumber(x)}" y="${formatNumber(referenceY)}">${escapeXml(part.reference)}</text>`,
    `<text class="part-value" x="${formatNumber(x)}" y="${formatNumber(valueY)}">${escapeXml(part.value)}</text>`,
  ].join('')
}

function renderLinearPartBody(
  part: Part,
  points: Array<{ x: number; y: number }>,
) {
  const [first, second] = points

  if (first === undefined || second === undefined) {
    return ''
  }

  const length = Math.hypot(second.x - first.x, second.y - first.y)
  const angle =
    (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI
  const transform = `translate(${formatNumber(first.x)} ${formatNumber(first.y)}) rotate(${formatNumber(angle)})`
  const labels = renderLabels(part, length / 2, -1.65, 0.75)

  switch (part.kind) {
    case 'resistor':
      return `<g class="part-body resistor" transform="${transform}"><line class="part-lead" x1="0" y1="0" x2="${formatNumber(length)}" y2="0"/><rect x="${formatNumber(length * 0.25)}" y="-0.8" width="${formatNumber(length * 0.5)}" height="1.6" rx="0.35"/>${labels}</g>`
    case 'diode':
      return `<g class="part-body diode" transform="${transform}"><line class="part-lead" x1="0" y1="0" x2="${formatNumber(length)}" y2="0"/><rect x="${formatNumber(length * 0.25)}" y="-0.8" width="${formatNumber(length * 0.5)}" height="1.6" rx="0.25"/><line class="cathode-band" x1="${formatNumber(length * 0.65)}" y1="-0.8" x2="${formatNumber(length * 0.65)}" y2="0.8"/>${labels}</g>`
    case 'capacitor':
      return `<g class="part-body capacitor" transform="${transform}"><line class="part-lead" x1="0" y1="0" x2="${formatNumber(length)}" y2="0"/><line class="capacitor-plate" x1="${formatNumber(length * 0.42)}" y1="-1" x2="${formatNumber(length * 0.42)}" y2="1"/><line class="capacitor-plate" x1="${formatNumber(length * 0.58)}" y1="-1" x2="${formatNumber(length * 0.58)}" y2="1"/>${part.polarized ? `<text class="polarity-mark" x="${formatNumber(length * 0.17)}" y="-0.75">+</text>` : ''}${renderLabels(part, length / 2, -1.6, 1.75)}</g>`
    case 'led': {
      const centerX = length / 2
      return `<g class="part-body led" transform="${transform}"><line class="part-lead" x1="0" y1="0" x2="${formatNumber(length)}" y2="0"/><circle cx="${formatNumber(centerX)}" cy="0" r="1.45" fill="${LED_COLOR_HEX[part.color]}"/><line class="cathode-band" x1="${formatNumber(centerX + 0.72)}" y1="-0.9" x2="${formatNumber(centerX + 0.72)}" y2="0.9"/>${renderLabels(part, centerX, -2.1, 0.8)}</g>`
    }
    default:
      return ''
  }
}

function getBounds(points: Array<{ x: number; y: number }>) {
  const xValues = points.map((point) => point.x)
  const yValues = points.map((point) => point.y)

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues),
  }
}

function renderRectangularPartBody(
  part: Part,
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) {
    return ''
  }

  const { minX, maxX, minY, maxY } = getBounds(points)
  const padding =
    part.kind === 'connector' ? 1.05 : part.kind === 'dip' ? 0.75 : 0.9
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const className =
    part.kind === 'dip'
      ? 'dip'
      : part.kind === 'pin-header'
        ? `pin-header pin-header-${part.gender}`
        : 'connector'
  const outerBodyClass =
    part.kind === 'pin-header' ? ' class="pin-header-body"' : ''
  const marker =
    part.kind === 'dip'
      ? `<circle class="pin-one-marker" cx="${formatNumber(points[0].x)}" cy="${formatNumber(points[0].y)}" r="0.58"/>`
      : part.kind === 'pin-header'
        ? `<circle class="pin-one-marker hollow" cx="${formatNumber(points[0].x)}" cy="${formatNumber(points[0].y)}" r="0.75"/>`
        : `<line class="connector-key" x1="${formatNumber(minX - padding)}" y1="${formatNumber(minY + 0.25)}" x2="${formatNumber(minX - 0.2)}" y2="${formatNumber(minY + 0.25)}"/>`
  const genderMarkers =
    part.kind !== 'pin-header'
      ? ''
      : points
          .map((point) =>
            part.gender === 'male'
              ? `<g><rect class="pin-header-male-pin" x="${formatNumber(point.x - 0.96)}" y="${formatNumber(point.y - 0.96)}" width="1.92" height="1.92" rx="0.18"/><rect class="pin-header-male-pin-tip" x="${formatNumber(point.x - 0.36)}" y="${formatNumber(point.y - 0.36)}" width="0.72" height="0.72" rx="0.1"/></g>`
              : `<g><circle class="pin-header-female-socket" cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="1.08"/><circle class="pin-header-female-opening" cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="0.54"/></g>`,
          )
          .join('')
  const genderLabel =
    part.kind === 'pin-header'
      ? `<text class="pin-header-gender pin-header-gender-${part.gender}" x="${formatNumber(centerX)}" y="${formatNumber(maxY + 1.8)}">${part.gender === 'male' ? 'オス・ピン' : 'メス・ソケット'}</text>`
      : ''

  return `<g class="part-body ${className}"><rect${outerBodyClass} x="${formatNumber(minX - padding)}" y="${formatNumber(minY - padding)}" width="${formatNumber(maxX - minX + padding * 2)}" height="${formatNumber(maxY - minY + padding * 2)}" rx="0.4"/>${genderMarkers}${marker}${genderLabel}${renderLabels(part, centerX, centerY - 0.25, centerY + 0.85)}</g>`
}

function renderTactileSwitchBody(
  part: TactileSwitchPart,
  points: Array<{ x: number; y: number }>,
) {
  if (points.length === 0) {
    return ''
  }

  const { minX, maxX, minY, maxY } = getBounds(points)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const bodySize = 6
  const bodyX = centerX - bodySize / 2
  const bodyY = centerY - bodySize / 2
  const buttonRadius = bodySize / 4

  return `<g class="part-body tactile-switch"><rect x="${formatNumber(bodyX)}" y="${formatNumber(bodyY)}" width="${formatNumber(bodySize)}" height="${formatNumber(bodySize)}" rx="${formatNumber(bodySize * 0.08)}"/><circle class="tactile-switch-button" cx="${formatNumber(centerX)}" cy="${formatNumber(centerY)}" r="${formatNumber(buttonRadius)}"/>${renderLabels(part, centerX, bodyY - 0.7, bodyY + bodySize + 1.15)}</g>`
}

function renderPartBody(
  part: Part,
  points: Array<{ x: number; y: number }>,
): string {
  if (part.kind === 'tactile-switch') {
    return renderTactileSwitchBody(part, points)
  }

  return part.kind === 'dip' ||
    part.kind === 'pin-header' ||
    part.kind === 'connector'
    ? renderRectangularPartBody(part, points)
    : renderLinearPartBody(part, points)
}

function renderPartOutline(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 2) {
    return `<line class="component-outline" x1="${formatNumber(points[0].x)}" y1="${formatNumber(points[0].y)}" x2="${formatNumber(points[1].x)}" y2="${formatNumber(points[1].y)}"/>`
  }

  const { minX, maxX, minY, maxY } = getBounds(points)
  return `<rect class="component-outline" x="${formatNumber(minX - 0.75)}" y="${formatNumber(minY - 0.75)}" width="${formatNumber(maxX - minX + 1.5)}" height="${formatNumber(maxY - minY + 1.5)}" rx="0.35"/>`
}

function renderPins(
  part: Part,
  points: Array<{ x: number; y: number }>,
): string {
  return points
    .map(
      (point, index) =>
        `<g class="part-pin"><circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="0.72"/><text x="${formatNumber(point.x)}" y="${formatNumber(point.y + 0.23)}">${escapeXml(part.pins[index]?.number ?? '')}</text></g>`,
    )
    .join('')
}

function renderParts(
  design: SvgExportDesign,
  metrics: SvgExportMetrics,
  side: AssemblySvgSide,
  mirrorHorizontally: boolean,
): string {
  return design.parts
    .map((part) => {
      const points = getPartPinPositions(part).map((point) =>
        pointToSvg(point, design.board, metrics, mirrorHorizontally),
      )
      const body =
        side === 'front'
          ? renderPartBody(part, points)
          : renderPartOutline(points)

      return `<g class="component component-${part.kind}">${body}${renderPins(part, points)}</g>`
    })
    .join('')
}

function renderWires(
  design: SvgExportDesign,
  metrics: SvgExportMetrics,
  side: AssemblySvgSide,
  mirrorHorizontally: boolean,
): string {
  return design.wires
    .filter((wire) => wire.side === side)
    .map((wire) => {
      const points = getWireDisplayGridPoints(
        wire,
        design.board,
        mirrorHorizontally,
      ).map((point) => pointToSvg(point, design.board, metrics, false))
      const path = points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
        )
        .join(' ')

      return `<g class="wire wire-${wire.side} wire-${wire.kind}"><path d="${path}" stroke="${escapeXml(wire.color)}"/>${points.map((point) => `<circle cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="0.68" fill="${escapeXml(wire.color)}"/>`).join('')}</g>`
    })
    .join('')
}

function renderBoard(
  board: Board,
  metrics: SvgExportMetrics,
  mirrorHorizontally: boolean,
): string {
  const columns = Array.from({ length: board.columns }, (_, index) => index)
  const rows = Array.from({ length: board.rows }, (_, index) => index)
  const holes = rows
    .flatMap((row) =>
      columns.map((column) => {
        const point = pointToSvg(
          { column, row },
          board,
          metrics,
          mirrorHorizontally,
        )
        return `<circle class="board-hole" cx="${formatNumber(point.x)}" cy="${formatNumber(point.y)}" r="0.63"/>`
      }),
    )
    .join('')
  const columnLabels = columns
    .map((column) => {
      const point = pointToSvg(
        { column, row: 0 },
        board,
        metrics,
        mirrorHorizontally,
      )
      return `<text class="column-label" x="${formatNumber(point.x)}" y="${formatNumber(metrics.boardY - 1.2)}">${column + 1}</text>`
    })
    .join('')
  const rowLabels = rows
    .map((row) => {
      const point = pointToSvg(
        { column: 0, row },
        board,
        metrics,
        mirrorHorizontally,
      )
      return `<text class="row-label" x="${formatNumber(metrics.boardX - 1.2)}" y="${formatNumber(point.y + 0.25)}">${row + 1}</text>`
    })
    .join('')
  const columnOne = pointToSvg(
    { column: 0, row: 0 },
    board,
    metrics,
    mirrorHorizontally,
  )

  return `<g class="board"><rect class="board-outline" x="${formatNumber(metrics.boardX)}" y="${formatNumber(metrics.boardY)}" width="${formatNumber(metrics.boardWidth)}" height="${formatNumber(metrics.boardHeight)}" rx="0.8"/>${columnLabels}${rowLabels}<g class="holes">${holes}</g><g class="orientation-mark"><path d="M ${formatNumber(columnOne.x)} ${formatNumber(metrics.boardY + 0.35)} l -1.1 1.6 h 2.2 z"/><text x="${formatNumber(columnOne.x)}" y="${formatNumber(metrics.boardY + 3.3)}">列1側</text></g></g>`
}

function renderStyles(side: AssemblySvgSide, showPartLabels: boolean): string {
  const boardFill = side === 'front' ? '#d7b779' : '#cbd5e1'

  return `<style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; fill: #101828; }
    .title { font-size: 3.2px; font-weight: 700; }
    .subtitle, .print-note { font-size: 2.2px; }
    .board-outline { fill: ${boardFill}; stroke: #475467; stroke-width: 0.35; }
    .board-hole { fill: #27354a; stroke: #ffffff; stroke-width: 0.22; }
    .column-label, .row-label { font-size: 1.55px; font-weight: 700; text-anchor: middle; }
    .orientation-mark path { fill: #b42318; }
    .orientation-mark text { fill: #b42318; font-size: 1.8px; font-weight: 700; text-anchor: middle; }
    .wire path { fill: none; stroke-width: 0.7; stroke-linecap: round; stroke-linejoin: round; }
    .wire-solder path { stroke-dasharray: 1.4 0.65; }
    .part-lead { stroke: #344054; stroke-width: 0.38; }
    .part-body rect, .part-body circle { stroke: #101828; stroke-width: 0.28; }
    .resistor rect { fill: #f4d78d; }
    .diode rect, .dip rect { fill: #303846; }
    .pin-header-body { fill: #344054; stroke: #101828; }
    .pin-header-male .pin-header-body { fill: #3d2b14; stroke: #fdb022; stroke-width: 0.42; }
    .pin-header-female .pin-header-body { fill: #153a4d; stroke: #67e8f9; stroke-width: 0.42; }
    .pin-header .pin-header-male-pin { fill: #fdb022; stroke: #fff1c2; stroke-width: 0.28; }
    .pin-header .pin-header-male-pin-tip { fill: #fff7d6; stroke: #b54708; stroke-width: 0.2; }
    .pin-header .pin-header-female-socket { fill: #466273; stroke: #7fb3c8; stroke-width: 0.28; }
    .pin-header .pin-header-female-opening { fill: #0b1f2a; stroke: #27485a; stroke-width: 0.2; }
    .capacitor-plate { stroke: #344054; stroke-width: 0.5; }
    .cathode-band { stroke: #ffffff; stroke-width: 0.42; }
    .connector rect { fill: #d0d5dd; }
    .tactile-switch rect { fill: #e0f2fe; stroke: #0369a1; }
    .tactile-switch .tactile-switch-button { fill: #ffffff; stroke: #0369a1; }
    .connector-key { stroke: #b42318; stroke-width: 0.45; }
    .pin-one-marker { fill: #d0d5dd; }
    .pin-one-marker.hollow { fill: none; stroke: #fdb022; }
    .part-reference, .part-value { text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 0.45px; stroke-linejoin: round; }
    .part-reference { font-size: 1.55px; font-weight: 700; }
    .part-value { font-size: 1.25px; font-weight: 600; }
    .pin-header-gender { font-size: 1.25px; font-weight: 900; text-anchor: middle; paint-order: stroke; stroke: #ffffff; stroke-width: 0.4px; stroke-linejoin: round; }
    .pin-header-gender-male { fill: #a15c00; }
    .pin-header-gender-female { fill: #0e7490; }
    ${showPartLabels ? '' : '.part-reference, .part-value, .pin-header-gender { display: none; }'}
    .polarity-mark { fill: #b42318; font-size: 2px; font-weight: 800; text-anchor: middle; }
    .part-pin circle { fill: #f9fafb; stroke: #344054; stroke-width: 0.28; }
    .part-pin text { font-size: 0.9px; font-weight: 700; text-anchor: middle; }
    .component-outline { fill: none; stroke: #667085; stroke-width: 0.28; stroke-dasharray: 1 0.65; opacity: 0.48; }
    .scale-bar { stroke: #101828; stroke-width: 0.35; }
    .scale-label { font-size: 1.8px; font-weight: 700; text-anchor: middle; }
  </style>`
}

export function generateAssemblySvg(
  design: SvgExportDesign,
  options: SvgExportOptions,
): string {
  const metrics = getSvgExportMetrics(design.board)
  const mirrorHorizontally = options.side === 'back' && options.mirrorBack
  const sideLabel = options.side === 'front' ? '表面・部品面' : '裏面・はんだ面'
  const orientationLabel =
    options.side === 'front'
      ? '表面方向'
      : options.mirrorBack
        ? '左右反転あり（はんだ面から見た向き）'
        : '左右反転なし（表面と同じ列方向）'
  const scaleY = metrics.boardY + metrics.boardHeight + 8
  const scaleX = metrics.boardX

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="ja" width="${formatNumber(metrics.widthMm)}mm" height="${formatNumber(metrics.heightMm)}mm" viewBox="0 0 ${formatNumber(metrics.widthMm)} ${formatNumber(metrics.heightMm)}">`,
    `<title>${escapeXml(design.metadata.name)} - ${sideLabel}</title>`,
    `<desc>2.54mmピッチのユニバーサル基板組み立て図。${orientationLabel}。印刷時は拡大縮小なし・100%で印刷してください。</desc>`,
    renderStyles(options.side, options.showPartLabels ?? true),
    `<text class="title" x="${formatNumber(SIDE_MARGIN_MM)}" y="5">${escapeXml(design.metadata.name)} — ${sideLabel}</text>`,
    `<text class="subtitle" x="${formatNumber(SIDE_MARGIN_MM)}" y="9">${orientationLabel}</text>`,
    renderBoard(
      design.board,
      metrics,
      options.side === 'back' && options.mirrorBack,
    ),
    `<g class="${options.side}-wires">${renderWires(design, metrics, options.side, mirrorHorizontally)}</g>`,
    `<g class="${options.side === 'front' ? 'front-components' : 'back-component-guides'}">${renderParts(design, metrics, options.side, mirrorHorizontally)}</g>`,
    `<g class="ten-mm-scale"><line class="scale-bar" x1="${formatNumber(scaleX)}" y1="${formatNumber(scaleY)}" x2="${formatNumber(scaleX + TEN_MM_SCALE_LENGTH)}" y2="${formatNumber(scaleY)}"/><line class="scale-bar" x1="${formatNumber(scaleX)}" y1="${formatNumber(scaleY - 1)}" x2="${formatNumber(scaleX)}" y2="${formatNumber(scaleY + 1)}"/><line class="scale-bar" x1="${formatNumber(scaleX + TEN_MM_SCALE_LENGTH)}" y1="${formatNumber(scaleY - 1)}" x2="${formatNumber(scaleX + TEN_MM_SCALE_LENGTH)}" y2="${formatNumber(scaleY + 1)}"/><text class="scale-label" x="${formatNumber(scaleX + TEN_MM_SCALE_LENGTH / 2)}" y="${formatNumber(scaleY + 3)}">確認用 10mm</text></g>`,
    `<text class="print-note" x="${formatNumber(SIDE_MARGIN_MM)}" y="${formatNumber(metrics.heightMm - 3.5)}">印刷時は拡大縮小なし・100%で印刷してください。</text>`,
    '</svg>',
    '',
  ].join('')
}
