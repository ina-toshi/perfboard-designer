import type { SvgPoint } from './coordinates'
import type { WireSide } from './wires'

export type DisplayMode = 'front' | 'back' | 'overlay'

export type BoardViewState = {
  displayMode: DisplayMode
  mirrorBack: boolean
  showPartLabels: boolean
  wireInspectionActive: boolean
  zoom: number
  pan: SvgPoint
}

export type BoardContentLayer = 'wires' | 'components'

export const DEFAULT_BOARD_VIEW_STATE: BoardViewState = {
  displayMode: 'front',
  mirrorBack: true,
  showPartLabels: false,
  wireInspectionActive: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
}

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 2.5

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function withZoom(view: BoardViewState, zoom: number): BoardViewState {
  return { ...view, zoom: clampZoom(zoom) }
}

export function withPan(view: BoardViewState, pan: SvgPoint): BoardViewState {
  return { ...view, pan }
}

export function shouldMirrorBoard(view: BoardViewState): boolean {
  return view.mirrorBack && view.displayMode === 'back'
}

export function shouldMirrorPart(view: BoardViewState): boolean {
  return shouldMirrorBoard(view)
}

export function shouldMirrorWire(
  view: BoardViewState,
  _side: WireSide,
): boolean {
  return shouldMirrorBoard(view)
}

export function getBoardContentLayerOrder(
  view: BoardViewState,
): BoardContentLayer[] {
  return view.wireInspectionActive
    ? ['components', 'wires']
    : ['wires', 'components']
}
