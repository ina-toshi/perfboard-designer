import type { SvgPoint } from '../../domain/coordinates'
import type { DipPart } from '../../domain/parts'

type DipPartViewProps = {
  part: DipPart
  pinPositions: SvgPoint[]
}

export function DipPartView({ part, pinPositions }: DipPartViewProps) {
  const xValues = pinPositions.map((point) => point.x)
  const yValues = pinPositions.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  const firstPin = pinPositions[0]

  return (
    <g>
      <rect
        className="dip-body"
        x={minX - 7}
        y={minY - 7}
        width={maxX - minX + 14}
        height={maxY - minY + 14}
        rx="4"
      />
      <circle
        className="dip-pin-one-marker"
        cx={firstPin.x}
        cy={firstPin.y}
        r="5"
      />
      <text className="part-reference" x={center.x} y={center.y - 3}>
        {part.reference}
      </text>
      <text className="part-value" x={center.x} y={center.y + 9}>
        {part.value}
      </text>
    </g>
  )
}
