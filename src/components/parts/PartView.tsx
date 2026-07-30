import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import type { Board } from '../../domain/board'
import type { SvgPoint } from '../../domain/coordinates'
import {
  getDisplayGridPoint,
  gridPointToSvgPoint,
} from '../../domain/coordinates'
import { getPartPinPositions, type Part } from '../../domain/parts'
import { CapacitorPartView } from './CapacitorPartView'
import { ConnectorPartView } from './ConnectorPartView'
import { DiodePartView } from './DiodePartView'
import { DipPartView } from './DipPartView'
import { LedPartView } from './LedPartView'
import { PinHeaderPartView } from './PinHeaderPartView'
import { ResistorPartView } from './ResistorPartView'
import { TactileSwitchPartView } from './TactileSwitchPartView'
import './PartView.css'

type PartViewProps = {
  part: Part
  board: Board
  mirrorHorizontally: boolean
  selected?: boolean
  highlighted?: boolean
  highlightedPinNumbers?: string[]
  previewState?: 'valid' | 'invalid'
  onSelect?: (partId: string) => void
  onDragStart?: (partId: string, event: PointerEvent<SVGGElement>) => void
}

function renderPartBody(part: Part, pinPositions: SvgPoint[]) {
  switch (part.kind) {
    case 'resistor':
      return <ResistorPartView part={part} pinPositions={pinPositions} />
    case 'led':
      return <LedPartView part={part} pinPositions={pinPositions} />
    case 'dip':
      return <DipPartView part={part} pinPositions={pinPositions} />
    case 'diode':
      return <DiodePartView part={part} pinPositions={pinPositions} />
    case 'capacitor':
      return <CapacitorPartView part={part} pinPositions={pinPositions} />
    case 'pin-header':
      return <PinHeaderPartView part={part} pinPositions={pinPositions} />
    case 'connector':
      return <ConnectorPartView part={part} pinPositions={pinPositions} />
    case 'tactile-switch':
      return <TactileSwitchPartView part={part} pinPositions={pinPositions} />
  }
}

export function PartView({
  part,
  board,
  mirrorHorizontally,
  selected = false,
  highlighted = false,
  highlightedPinNumbers = [],
  previewState,
  onSelect,
  onDragStart,
}: PartViewProps) {
  const pinPositions = getPartPinPositions(part).map((point) =>
    gridPointToSvgPoint(getDisplayGridPoint(point, board, mirrorHorizontally)),
  )
  const classNames = [
    'part',
    `part-${part.kind}`,
    onSelect === undefined ? '' : 'is-selectable',
    selected ? 'is-selected' : '',
    highlighted ? 'is-connectivity-highlighted' : '',
    previewState === undefined ? '' : `is-preview-${previewState}`,
  ]
    .filter(Boolean)
    .join(' ')

  function selectPart(event: MouseEvent<SVGGElement>) {
    if (onSelect === undefined) {
      return
    }
    event.stopPropagation()
    onSelect(part.id)
  }

  function selectPartWithKeyboard(event: KeyboardEvent<SVGGElement>) {
    if (
      onSelect !== undefined &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault()
      onSelect(part.id)
    }
  }

  function startPartDrag(event: PointerEvent<SVGGElement>) {
    onDragStart?.(part.id, event)
  }

  return (
    <g
      className={classNames}
      role={onSelect === undefined ? undefined : 'button'}
      tabIndex={onSelect === undefined ? undefined : 0}
      aria-label={`${part.reference} ${part.value}`}
      onClick={selectPart}
      onKeyDown={selectPartWithKeyboard}
      onPointerDown={startPartDrag}
    >
      {renderPartBody(part, pinPositions)}
      <g className="part-pins">
        {pinPositions.map((position, index) => (
          <g
            key={part.pins[index].number}
            className={
              highlightedPinNumbers.includes(part.pins[index].number)
                ? 'is-connectivity-highlighted'
                : undefined
            }
          >
            <circle cx={position.x} cy={position.y} r="6" />
            <text x={position.x} y={position.y + 3}>
              {part.pins[index].number}
            </text>
          </g>
        ))}
      </g>
    </g>
  )
}
