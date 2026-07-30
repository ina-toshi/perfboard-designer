import type { SvgPoint } from '../../domain/coordinates'
import type { ConnectorPart } from '../../domain/parts'

type ConnectorPartViewProps = {
  part: ConnectorPart
  pinPositions: SvgPoint[]
}

export function ConnectorPartView({
  part,
  pinPositions,
}: ConnectorPartViewProps) {
  const xValues = pinPositions.map((point) => point.x)
  const yValues = pinPositions.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const centerX = (minX + maxX) / 2

  return (
    <g>
      <rect
        className="connector-body"
        x={minX - 10}
        y={minY - 10}
        width={maxX - minX + 20}
        height={maxY - minY + 20}
        rx="5"
      />
      <path
        className="connector-key"
        d={`M ${minX - 10} ${minY + 2} L ${minX - 4} ${minY + 2}`}
      />
      <text className="part-reference external-label" x={centerX} y={minY - 14}>
        {part.reference}
      </text>
      <text className="part-value external-label" x={centerX} y={maxY + 19}>
        {part.value}
      </text>
    </g>
  )
}
