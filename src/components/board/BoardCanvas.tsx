import { useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent, WheelEvent } from 'react'
import type { Board, GridOffset, GridPoint } from '../../domain/board'
import {
  getBoardSvgSize,
  getDisplayGridPoint,
  gridPointToSvgPoint,
  nearestHoleFromSvgPoint,
} from '../../domain/coordinates'
import { isPartWithinBoard, type Part } from '../../domain/parts'
import {
  getWireDisplayEmphasis,
  isWireWithinBoard,
  isZeroLengthWire,
  type Wire,
  type WireSide,
} from '../../domain/wires'
import type { BoardViewState } from '../../domain/view'
import {
  shouldMirrorBoard,
  shouldMirrorPart,
  shouldMirrorWire,
} from '../../domain/view'
import type { BoardHighlight } from '../../domain/connectivityPresentation'
import { PartView } from '../parts/PartView'
import { WireEndpointTargets, WireView } from '../wiring/WireView'
import './BoardCanvas.css'

type BoardCanvasProps = {
  board: Board
  view: BoardViewState
  parts: Part[]
  wires: Wire[]
  selectedPartId: string | null
  selectedWireId: string | null
  placementPreview: Part | null
  placementActive: boolean
  wireToolSide: WireSide | null
  wireDraftPreview: Wire | null
  wireDraftActive: boolean
  highlight: BoardHighlight | null
  onPan: (delta: { x: number; y: number }) => void
  onZoom: (delta: number) => void
  onGridHover: (point: GridPoint | null) => void
  onWireHover: (point: GridPoint | null) => void
  onGridClick: (point: GridPoint) => void
  onWireGridClick: (point: GridPoint) => void
  onSelectPart: (partId: string | null) => void
  onSelectWire: (wireId: string | null) => void
  onMovePart: (partId: string, offset: GridOffset) => void
  onMoveWire: (wireId: string, offset: GridOffset) => void
  onMoveWireEndpoint: (
    wireId: string,
    endpointIndex: 0 | 1,
    point: GridPoint,
  ) => void
  onClearSelection: () => void
}

type PanSession = {
  pointerId: number
  origin: { x: number; y: number }
}

type ElementDragSession = {
  pointerId: number
  kind: 'part' | 'wire' | 'wire-endpoint'
  id: string
  start: GridPoint
  pointerOrigin: { x: number; y: number }
  moved: boolean
  mirrorHorizontally: boolean
  endpointIndex?: 0 | 1
}

type ElementDragPreview = Omit<
  ElementDragSession,
  'moved' | 'pointerOrigin'
> & {
  end: GridPoint
}

const elementDragStartDistance = 4

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index)
}

export function BoardCanvas({
  board,
  view,
  parts,
  wires,
  selectedPartId,
  selectedWireId,
  placementPreview,
  placementActive,
  wireToolSide,
  wireDraftPreview,
  wireDraftActive,
  highlight,
  onPan,
  onZoom,
  onGridHover,
  onWireHover,
  onGridClick,
  onWireGridClick,
  onSelectPart,
  onSelectWire,
  onMovePart,
  onMoveWire,
  onMoveWireEndpoint,
  onClearSelection,
}: BoardCanvasProps) {
  const panSessionRef = useRef<PanSession | null>(null)
  const didPanRef = useRef(false)
  const elementDragSessionRef = useRef<ElementDragSession | null>(null)
  const [elementDragPreview, setElementDragPreview] =
    useState<ElementDragPreview | null>(null)
  const boardSize = getBoardSvgSize(board)
  const mirrorBoard = shouldMirrorBoard(view)
  const partMirror = shouldMirrorPart(view)
  const columns = range(board.columns)
  const rows = range(board.rows)
  const visibleParts = parts.filter(
    (part) =>
      (placementPreview === null || placementPreview.id !== part.id) &&
      !(
        elementDragPreview?.kind === 'part' && elementDragPreview.id === part.id
      ),
  )
  const previewValid =
    placementPreview !== null && isPartWithinBoard(placementPreview, board)
  const elementDragOffset =
    elementDragPreview === null
      ? null
      : {
          column:
            elementDragPreview.end.column - elementDragPreview.start.column,
          row: elementDragPreview.end.row - elementDragPreview.start.row,
        }
  const draggedPart =
    elementDragPreview?.kind === 'part'
      ? (parts.find((part) => part.id === elementDragPreview.id) ?? null)
      : null
  const draggedPartPreview =
    draggedPart === null || elementDragOffset === null
      ? null
      : {
          ...draggedPart,
          origin: {
            column: draggedPart.origin.column + elementDragOffset.column,
            row: draggedPart.origin.row + elementDragOffset.row,
          },
        }
  const draggedWire =
    elementDragPreview?.kind === 'wire' ||
    elementDragPreview?.kind === 'wire-endpoint'
      ? (wires.find((wire) => wire.id === elementDragPreview.id) ?? null)
      : null
  const draggedWirePreview =
    draggedWire === null || elementDragOffset === null
      ? null
      : {
          ...draggedWire,
          points: draggedWire.points.map((point, index) =>
            elementDragPreview?.kind === 'wire-endpoint'
              ? index === elementDragPreview.endpointIndex
                ? { ...elementDragPreview.end }
                : { ...point }
              : {
                  column: point.column + elementDragOffset.column,
                  row: point.row + elementDragOffset.row,
                },
          ),
        }
  const selectionToolActive = !placementActive && wireToolSide === null
  const interactionActive = placementActive || wireToolSide !== null
  const isNetIsolationActive = highlight?.key.startsWith('net:') ?? false
  const wireDisplayMode = isNetIsolationActive ? 'overlay' : view.displayMode
  const wireLayerOrder: WireSide[] =
    view.displayMode === 'back' ? ['front', 'back'] : ['back', 'front']
  const highlightedWireIds = new Set(highlight?.wireIds ?? [])
  const highlightedPartIds = new Set(highlight?.partIds ?? [])
  const highlightedPinsByPart = new Map<string, string[]>()

  if (!isNetIsolationActive) {
    for (const pin of highlight?.pins ?? []) {
      highlightedPinsByPart.set(pin.partId, [
        ...(highlightedPinsByPart.get(pin.partId) ?? []),
        pin.pinNumber,
      ])
    }
  }

  const highlightStyle =
    highlight?.color === undefined
      ? undefined
      : ({
          '--connectivity-highlight-color': highlight.color,
        } as CSSProperties)

  function isVisibleWire(wire: Wire): boolean {
    return !isNetIsolationActive || highlightedWireIds.has(wire.id)
  }

  function isGuideWire(wire: Wire): boolean {
    return getWireDisplayEmphasis(wire.side, view.displayMode) === 'guide'
  }

  function toDisplayPoint(point: GridPoint) {
    return gridPointToSvgPoint(getDisplayGridPoint(point, board, partMirror))
  }

  function eventToStoredGridPoint(
    svg: SVGSVGElement,
    clientPoint: { x: number; y: number },
    mirrorHorizontally = mirrorBoard,
  ): GridPoint | null {
    const screenMatrix = svg.getScreenCTM()

    if (screenMatrix === null) {
      return null
    }

    const svgPoint = new DOMPoint(clientPoint.x, clientPoint.y).matrixTransform(
      screenMatrix.inverse(),
    )
    const pointBeforeViewTransform = {
      x: (svgPoint.x - view.pan.x) / view.zoom,
      y: (svgPoint.y - view.pan.y) / view.zoom,
    }
    const displayedGridPoint = nearestHoleFromSvgPoint(
      pointBeforeViewTransform,
      board,
    )

    return displayedGridPoint === null
      ? null
      : getDisplayGridPoint(displayedGridPoint, board, mirrorHorizontally)
  }

  function getWireMirror(side: WireSide): boolean {
    return shouldMirrorWire(view, side)
  }

  function getInteractionMirror(): boolean {
    if (placementActive) {
      return partMirror
    }

    return wireToolSide === null ? partMirror : getWireMirror(wireToolSide)
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (!event.metaKey && !event.ctrlKey) {
      return
    }

    event.preventDefault()
    onZoom(event.deltaY < 0 ? 0.1 : -0.1)
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    didPanRef.current = false
    panSessionRef.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const session = panSessionRef.current

    if (session !== null && session.pointerId === event.pointerId) {
      const delta = {
        x: (event.clientX - session.origin.x) / view.zoom,
        y: (event.clientY - session.origin.y) / view.zoom,
      }

      if (delta.x !== 0 || delta.y !== 0) {
        didPanRef.current = true
      }
      session.origin = { x: event.clientX, y: event.clientY }
      onPan(delta)
      return
    }

    const elementDragSession = elementDragSessionRef.current

    if (
      elementDragSession !== null &&
      elementDragSession.pointerId === event.pointerId
    ) {
      if (!elementDragSession.moved) {
        const distance = Math.hypot(
          event.clientX - elementDragSession.pointerOrigin.x,
          event.clientY - elementDragSession.pointerOrigin.y,
        )

        if (distance < elementDragStartDistance) {
          return
        }

        elementDragSession.moved = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }

      const point = eventToStoredGridPoint(
        event.currentTarget,
        {
          x: event.clientX,
          y: event.clientY,
        },
        elementDragSession.mirrorHorizontally,
      )

      if (point !== null) {
        setElementDragPreview((currentPreview) => {
          if (
            currentPreview?.pointerId === elementDragSession.pointerId &&
            currentPreview.end.column === point.column &&
            currentPreview.end.row === point.row
          ) {
            return currentPreview
          }

          return {
            pointerId: elementDragSession.pointerId,
            kind: elementDragSession.kind,
            id: elementDragSession.id,
            start: elementDragSession.start,
            end: point,
            mirrorHorizontally: elementDragSession.mirrorHorizontally,
            endpointIndex: elementDragSession.endpointIndex,
          }
        })
      }
      return
    }

    const gridPoint = eventToStoredGridPoint(
      event.currentTarget,
      {
        x: event.clientX,
        y: event.clientY,
      },
      getInteractionMirror(),
    )

    if (placementActive) {
      onGridHover(gridPoint)
    } else if (wireDraftActive) {
      onWireHover(gridPoint)
    }
  }

  function handlePointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (panSessionRef.current?.pointerId === event.pointerId) {
      panSessionRef.current = null
    }

    const elementDragSession = elementDragSessionRef.current

    if (
      elementDragSession === null ||
      elementDragSession.pointerId !== event.pointerId
    ) {
      return
    }

    elementDragSessionRef.current = null
    setElementDragPreview(null)

    const end = eventToStoredGridPoint(
      event.currentTarget,
      {
        x: event.clientX,
        y: event.clientY,
      },
      elementDragSession.mirrorHorizontally,
    )

    if (
      end === null ||
      !elementDragSession.moved ||
      (end.column === elementDragSession.start.column &&
        end.row === elementDragSession.start.row)
    ) {
      return
    }

    const offset = {
      column: end.column - elementDragSession.start.column,
      row: end.row - elementDragSession.start.row,
    }

    if (elementDragSession.kind === 'part') {
      onMovePart(elementDragSession.id, offset)
    } else if (elementDragSession.kind === 'wire') {
      onMoveWire(elementDragSession.id, offset)
    } else {
      onMoveWireEndpoint(
        elementDragSession.id,
        elementDragSession.endpointIndex ?? 0,
        end,
      )
    }

    didPanRef.current = true
  }

  function handlePointerCancel(event: PointerEvent<SVGSVGElement>) {
    if (panSessionRef.current?.pointerId === event.pointerId) {
      panSessionRef.current = null
    }

    if (elementDragSessionRef.current?.pointerId === event.pointerId) {
      elementDragSessionRef.current = null
    }
    setElementDragPreview((currentPreview) =>
      currentPreview?.pointerId === event.pointerId ? null : currentPreview,
    )
  }

  function beginElementDrag(
    kind: 'part' | 'wire' | 'wire-endpoint',
    id: string,
    event: PointerEvent<SVGElement>,
    endpointIndex?: 0 | 1,
  ) {
    if (!selectionToolActive || event.button !== 0) {
      return
    }

    if (kind === 'part') {
      onSelectPart(id)
    } else {
      onSelectWire(id)
    }

    const svg = event.currentTarget.ownerSVGElement
    const wire =
      kind === 'part' ? null : (wires.find((item) => item.id === id) ?? null)
    const elementMirror =
      kind === 'part'
        ? partMirror
        : wire === null
          ? mirrorBoard
          : getWireMirror(wire.side)
    const start =
      svg === null
        ? null
        : eventToStoredGridPoint(
            svg,
            { x: event.clientX, y: event.clientY },
            elementMirror,
          )

    if (start === null || svg === null) {
      return
    }

    setElementDragPreview(null)
    elementDragSessionRef.current = {
      pointerId: event.pointerId,
      kind,
      id,
      start,
      pointerOrigin: { x: event.clientX, y: event.clientY },
      moved: false,
      mirrorHorizontally: elementMirror,
      endpointIndex,
    }
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    if (didPanRef.current) {
      didPanRef.current = false
      return
    }

    const gridPoint = eventToStoredGridPoint(
      event.currentTarget,
      {
        x: event.clientX,
        y: event.clientY,
      },
      getInteractionMirror(),
    )

    if (placementActive && gridPoint !== null) {
      onGridClick(gridPoint)
      return
    }

    if (wireToolSide !== null && gridPoint !== null) {
      onWireGridClick(gridPoint)
      return
    }

    if (selectionToolActive) {
      onClearSelection()
    }
  }

  return (
    <section className="board-canvas" aria-label="基板プレビュー">
      <svg
        className={[
          'board-svg',
          interactionActive ? 'is-placing' : '',
          highlight === null ? '' : 'has-connectivity-highlight',
          highlight === null ? '' : `highlight-${highlight.tone}`,
        ]
          .filter(Boolean)
          .join(' ')}
        style={highlightStyle}
        viewBox={`0 0 ${boardSize.x} ${boardSize.y}`}
        role="img"
        aria-label={`${board.columns}列${board.rows}行のユニバーサル基板`}
        data-display-mode={view.displayMode}
        data-back-mirrored={mirrorBoard}
        data-part-labels-visible={view.showPartLabels}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          if (placementActive) {
            onGridHover(null)
          } else if (wireDraftActive) {
            onWireHover(null)
          }
        }}
        onClick={handleCanvasClick}
      >
        <title>2.54mmピッチのユニバーサル基板</title>
        <g
          transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`}
        >
          <g data-layer="board">
            <rect
              className="board-outline"
              x="38"
              y="34"
              width={boardSize.x - 56}
              height={boardSize.y - 52}
              rx="8"
            />
            <g className="column-labels" aria-hidden="true">
              {columns.map((column) => {
                const position = toDisplayPoint({ column, row: 0 })

                return (
                  <text key={column} x={position.x} y="24" textAnchor="middle">
                    {column + 1}
                  </text>
                )
              })}
            </g>
            <g className="row-labels" aria-hidden="true">
              {rows.map((row) => {
                const position = toDisplayPoint({ column: 0, row })

                return (
                  <text key={row} x="22" y={position.y + 4} textAnchor="middle">
                    {row + 1}
                  </text>
                )
              })}
            </g>
            <g className="hole-grid" data-layer="holes" aria-hidden="true">
              {rows.flatMap((row) =>
                columns.map((column) => {
                  const position = toDisplayPoint({ column, row })

                  return (
                    <circle
                      key={`${column}-${row}`}
                      className="board-hole"
                      cx={position.x}
                      cy={position.y}
                      r="4.8"
                    />
                  )
                }),
              )}
            </g>
            <g className="board-orientation" aria-hidden="true">
              <circle
                cx={toDisplayPoint({ column: 0, row: 0 }).x}
                cy={toDisplayPoint({ column: 0, row: 0 }).y}
                r="9"
              />
              <text
                x={toDisplayPoint({ column: 0, row: 0 }).x}
                y={toDisplayPoint({ column: 0, row: 0 }).y + 3}
                textAnchor="middle"
              >
                1
              </text>
            </g>
          </g>
          {highlight !== null && !isNetIsolationActive && (
            <g
              className="connectivity-highlight-holes"
              data-layer="connectivity-highlight-holes"
              aria-label={`${highlight.label}の関係する基板穴`}
            >
              {highlight.holes.map((hole) => {
                const position = toDisplayPoint(hole)

                return (
                  <circle
                    key={`${hole.column}-${hole.row}`}
                    cx={position.x}
                    cy={position.y}
                    r="10"
                  />
                )
              })}
            </g>
          )}
          {wireLayerOrder.map((side) => (
            <g key={side} data-layer={`${side}-wires`}>
              {wires
                .filter(
                  (wire) =>
                    wire.side === side &&
                    isVisibleWire(wire) &&
                    !(
                      (elementDragPreview?.kind === 'wire' ||
                        elementDragPreview?.kind === 'wire-endpoint') &&
                      elementDragPreview.id === wire.id
                    ),
                )
                .map((wire) => (
                  <WireView
                    key={wire.id}
                    wire={wire}
                    board={board}
                    displayMode={wireDisplayMode}
                    mirrorHorizontally={getWireMirror(wire.side)}
                    selected={!isGuideWire(wire) && wire.id === selectedWireId}
                    highlighted={
                      !isGuideWire(wire) &&
                      !isNetIsolationActive &&
                      highlightedWireIds.has(wire.id)
                    }
                    onSelect={selectionToolActive ? onSelectWire : undefined}
                    onDragStart={
                      selectionToolActive
                        ? (wireId, event) =>
                            beginElementDrag('wire', wireId, event)
                        : undefined
                    }
                  />
                ))}
            </g>
          ))}
          <g data-layer="front-components">
            {visibleParts.map((part) => (
              <PartView
                key={part.id}
                part={part}
                board={board}
                mirrorHorizontally={partMirror}
                selected={part.id === selectedPartId}
                highlighted={
                  !isNetIsolationActive && highlightedPartIds.has(part.id)
                }
                highlightedPinNumbers={highlightedPinsByPart.get(part.id) ?? []}
                onSelect={selectionToolActive ? onSelectPart : undefined}
                onDragStart={
                  selectionToolActive
                    ? (partId, event) => beginElementDrag('part', partId, event)
                    : undefined
                }
              />
            ))}
          </g>
          {selectionToolActive && (
            <g data-layer="wire-endpoint-targets">
              {wireLayerOrder.flatMap((side) =>
                wires
                  .filter((wire) => wire.side === side && isVisibleWire(wire))
                  .filter(
                    (wire) =>
                      !(
                        (elementDragPreview?.kind === 'wire' ||
                          elementDragPreview?.kind === 'wire-endpoint') &&
                        elementDragPreview.id === wire.id
                      ),
                  )
                  .map((wire) => (
                    <WireEndpointTargets
                      key={wire.id}
                      wire={wire}
                      board={board}
                      mirrorHorizontally={getWireMirror(wire.side)}
                      onSelect={onSelectWire}
                      onDragStart={(wireId, endpointIndex, event) =>
                        beginElementDrag(
                          'wire-endpoint',
                          wireId,
                          event,
                          endpointIndex,
                        )
                      }
                    />
                  )),
              )}
            </g>
          )}
          <g data-layer="selection">
            {placementPreview !== null && (
              <PartView
                part={placementPreview}
                board={board}
                mirrorHorizontally={partMirror}
                previewState={previewValid ? 'valid' : 'invalid'}
              />
            )}
            {wireDraftPreview !== null && isVisibleWire(wireDraftPreview) && (
              <WireView
                wire={wireDraftPreview}
                board={board}
                displayMode={wireDisplayMode}
                mirrorHorizontally={getWireMirror(wireDraftPreview.side)}
                previewState={
                  isZeroLengthWire(wireDraftPreview) ? 'invalid' : 'valid'
                }
              />
            )}
            {draggedPartPreview !== null && (
              <PartView
                part={draggedPartPreview}
                board={board}
                mirrorHorizontally={partMirror}
                previewState={
                  isPartWithinBoard(draggedPartPreview, board)
                    ? 'valid'
                    : 'invalid'
                }
              />
            )}
            {draggedWirePreview !== null &&
              isVisibleWire(draggedWirePreview) && (
                <WireView
                  wire={draggedWirePreview}
                  board={board}
                  displayMode={wireDisplayMode}
                  mirrorHorizontally={getWireMirror(draggedWirePreview.side)}
                  previewState={
                    isWireWithinBoard(draggedWirePreview, board) &&
                    !isZeroLengthWire(draggedWirePreview)
                      ? 'valid'
                      : 'invalid'
                  }
                />
              )}
          </g>
        </g>
      </svg>
      {highlight !== null && (
        <p className={`board-highlight-label highlight-${highlight.tone}`}>
          {isNetIsolationActive ? '選択中のネット' : '基板強調中'}:{' '}
          {highlight.label}
        </p>
      )}
      <p className="board-canvas-help">
        {wireToolSide === null
          ? '部品または配線をドラッグして移動（クリックで選択）'
          : '始点と終点の穴を順にクリックして配線'}
        {' / '}拡大・縮小: ⌘またはControl + ホイール操作 / 移動: Shift +
        ドラッグ
      </p>
    </section>
  )
}
