import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import type { Board } from '../../domain/board'
import { gridPointToSvgPoint } from '../../domain/coordinates'
import {
  getWireDisplayEmphasis,
  getWireDisplayGridPoints,
  getWireLabel,
  type Wire,
} from '../../domain/wires'
import type { DisplayMode } from '../../domain/view'
import './WireView.css'

type WireViewProps = {
  wire: Wire
  board: Board
  displayMode: DisplayMode
  mirrorHorizontally: boolean
  selected?: boolean
  highlighted?: boolean
  previewState?: 'valid' | 'invalid'
  onSelect?: (wireId: string) => void
  onDragStart?: (wireId: string, event: PointerEvent<SVGGElement>) => void
}

type WireEndpointTargetsProps = {
  wire: Wire
  board: Board
  mirrorHorizontally: boolean
  onSelect: (wireId: string) => void
  onDragStart?: (
    wireId: string,
    endpointIndex: 0 | 1,
    event: PointerEvent<SVGCircleElement>,
  ) => void
}

export function WireView({
  wire,
  board,
  displayMode,
  mirrorHorizontally,
  selected = false,
  highlighted = false,
  previewState,
  onSelect,
  onDragStart,
}: WireViewProps) {
  const points = getWireDisplayGridPoints(wire, board, mirrorHorizontally).map(
    (point) => gridPointToSvgPoint(point),
  )
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const emphasis = getWireDisplayEmphasis(wire.side, displayMode)
  const classNames = [
    'wire',
    `wire-${wire.side}`,
    `wire-${wire.kind}`,
    onSelect === undefined ? '' : 'is-selectable',
    emphasis === 'guide' ? 'is-guide' : '',
    selected ? 'is-selected' : '',
    highlighted ? 'is-connectivity-highlighted' : '',
    previewState === undefined ? '' : `is-preview-${previewState}`,
  ]
    .filter(Boolean)
    .join(' ')

  function selectWire(event: MouseEvent<SVGGElement>) {
    if (onSelect === undefined) {
      return
    }
    event.stopPropagation()
    onSelect(wire.id)
  }

  function startWireDrag(event: PointerEvent<SVGGElement>) {
    onDragStart?.(wire.id, event)
  }

  function selectWireWithKeyboard(event: KeyboardEvent<SVGGElement>) {
    if (
      onSelect !== undefined &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault()
      onSelect(wire.id)
    }
  }

  return (
    <g
      className={classNames}
      role={onSelect === undefined ? undefined : 'button'}
      tabIndex={onSelect === undefined ? undefined : 0}
      aria-label={`${getWireLabel(wire.kind, wire.side)} ${wire.id}`}
      onClick={selectWire}
      onKeyDown={selectWireWithKeyboard}
      onPointerDown={startWireDrag}
    >
      <path
        className="wire-path"
        d={path}
        stroke={wire.color}
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point, index) => (
        <circle
          key={`${wire.id}-${index}`}
          className="wire-endpoint"
          cx={point.x}
          cy={point.y}
          r="6"
          fill={wire.color}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {onSelect !== undefined && (
        <path
          className="wire-hit-target"
          d={path}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}

export function WireEndpointTargets({
  wire,
  board,
  mirrorHorizontally,
  onSelect,
  onDragStart,
}: WireEndpointTargetsProps) {
  const endpoints = getWireDisplayGridPoints(
    wire,
    board,
    mirrorHorizontally,
  ).map((point) => gridPointToSvgPoint(point))

  function selectWire(event: MouseEvent<SVGCircleElement>) {
    event.stopPropagation()
    onSelect(wire.id)
  }

  function startWireDrag(
    endpointIndex: 0 | 1,
    event: PointerEvent<SVGCircleElement>,
  ) {
    onDragStart?.(wire.id, endpointIndex, event)
  }

  return (
    <g className="wire-endpoint-targets">
      {[endpoints[0], endpoints[endpoints.length - 1]].map(
        (point, index) =>
          point !== undefined && (
            <circle
              key={`${wire.id}-endpoint-target-${index}`}
              className="wire-endpoint-hit-target"
              cx={point.x}
              cy={point.y}
              r="6"
              onClick={selectWire}
              onPointerDown={(event) => startWireDrag(index as 0 | 1, event)}
              vectorEffect="non-scaling-stroke"
            />
          ),
      )}
    </g>
  )
}
