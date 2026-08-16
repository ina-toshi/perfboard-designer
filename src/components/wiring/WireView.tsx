import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import type { Board } from '../../domain/board'
import { gridPointToSvgPoint, type SvgPoint } from '../../domain/coordinates'
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

const WIRE_CORNER_RADIUS = 28

function getDistance(first: SvgPoint, second: SvgPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function pointToward(
  origin: SvgPoint,
  target: SvgPoint,
  distance: number,
): SvgPoint {
  const totalDistance = getDistance(origin, target)

  if (totalDistance === 0) {
    return { ...origin }
  }

  const ratio = distance / totalDistance
  return {
    x: origin.x + (target.x - origin.x) * ratio,
    y: origin.y + (target.y - origin.y) * ratio,
  }
}

function createRoundedWirePath(points: SvgPoint[]): string {
  const first = points[0]

  if (first === undefined) {
    return ''
  }
  if (points.length === 1) {
    return `M ${first.x} ${first.y}`
  }

  const commands = [`M ${first.x} ${first.y}`]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]

    if (previous === undefined || corner === undefined || next === undefined) {
      continue
    }

    const incomingLength = getDistance(previous, corner)
    const outgoingLength = getDistance(corner, next)
    const cross =
      (corner.x - previous.x) * (next.y - corner.y) -
      (corner.y - previous.y) * (next.x - corner.x)

    if (
      incomingLength === 0 ||
      outgoingLength === 0 ||
      Math.abs(cross) < 0.001
    ) {
      commands.push(`L ${corner.x} ${corner.y}`)
      continue
    }

    const radius = Math.min(
      WIRE_CORNER_RADIUS,
      incomingLength * 0.45,
      outgoingLength * 0.45,
    )
    const entry = pointToward(corner, previous, radius)
    const exit = pointToward(corner, next, radius)

    commands.push(`L ${entry.x} ${entry.y}`)
    commands.push(`Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`)
  }

  const last = points[points.length - 1]
  if (last !== undefined) {
    commands.push(`L ${last.x} ${last.y}`)
  }

  return commands.join(' ')
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
  const path = createRoundedWirePath(points)
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
  const endpoints = [points[0], points[points.length - 1]].filter(
    (point): point is SvgPoint => point !== undefined,
  )

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
      {endpoints.map((point, index) => (
        <circle
          key={`${wire.id}-endpoint-${index}`}
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
