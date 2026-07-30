import type { SvgPoint } from '../../domain/coordinates'
import type { ResistorPart } from '../../domain/parts'

type ResistorPartViewProps = {
  part: ResistorPart
  pinPositions: SvgPoint[]
}

export function ResistorPartView({
  part,
  pinPositions,
}: ResistorPartViewProps) {
  const [firstPin, secondPin] = pinPositions
  const length = Math.hypot(secondPin.x - firstPin.x, secondPin.y - firstPin.y)
  const angle =
    (Math.atan2(secondPin.y - firstPin.y, secondPin.x - firstPin.x) * 180) /
    Math.PI

  return (
    <g transform={`translate(${firstPin.x} ${firstPin.y}) rotate(${angle})`}>
      <line className="part-lead" x1="0" y1="0" x2={length} y2="0" />
      <rect
        className="resistor-body"
        x={length * 0.25}
        y="-7"
        width={length * 0.5}
        height="14"
        rx="4"
      />
      <text className="part-reference" x={length / 2} y="-12">
        {part.reference}
      </text>
      <text className="part-value" x={length / 2} y="3">
        {part.value}
      </text>
    </g>
  )
}
