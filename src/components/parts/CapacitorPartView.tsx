import type { SvgPoint } from '../../domain/coordinates'
import type { CapacitorPart } from '../../domain/parts'

type CapacitorPartViewProps = {
  part: CapacitorPart
  pinPositions: SvgPoint[]
}

export function CapacitorPartView({
  part,
  pinPositions,
}: CapacitorPartViewProps) {
  const [positive, negative] = pinPositions
  const length = Math.hypot(negative.x - positive.x, negative.y - positive.y)
  const angle =
    (Math.atan2(negative.y - positive.y, negative.x - positive.x) * 180) /
    Math.PI

  return (
    <g transform={`translate(${positive.x} ${positive.y}) rotate(${angle})`}>
      <line className="part-lead" x1="0" y1="0" x2={length} y2="0" />
      <line
        className="capacitor-plate"
        x1={length * 0.42}
        y1="-9"
        x2={length * 0.42}
        y2="9"
      />
      <line
        className="capacitor-plate"
        x1={length * 0.58}
        y1="-9"
        x2={length * 0.58}
        y2="9"
      />
      {part.polarized && (
        <text className="capacitor-positive" x={length * 0.18} y="-7">
          +
        </text>
      )}
      <text className="part-reference" x={length / 2} y="-14">
        {part.reference}
      </text>
      <text className="part-value" x={length / 2} y="17">
        {part.value}
      </text>
    </g>
  )
}
