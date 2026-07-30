import type { SvgPoint } from '../../domain/coordinates'
import type { PinHeaderPart } from '../../domain/parts'

type PinHeaderPartViewProps = {
  part: PinHeaderPart
  pinPositions: SvgPoint[]
}

export function PinHeaderPartView({
  part,
  pinPositions,
}: PinHeaderPartViewProps) {
  const xValues = pinPositions.map((point) => point.x)
  const yValues = pinPositions.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const centerX = (minX + maxX) / 2

  return (
    <g className={`pin-header-${part.gender}`}>
      <rect
        className="pin-header-body"
        x={minX - 9}
        y={minY - 9}
        width={maxX - minX + 18}
        height={maxY - minY + 18}
        rx="3"
      />
      {pinPositions.map((position, index) =>
        part.gender === 'male' ? (
          <g key={part.pins[index].number}>
            <rect
              className="pin-header-male-pin"
              x={position.x - 8}
              y={position.y - 8}
              width="16"
              height="16"
              rx="2"
            />
            <rect
              className="pin-header-male-pin-tip"
              x={position.x - 3}
              y={position.y - 3}
              width="6"
              height="6"
              rx="1"
            />
          </g>
        ) : (
          <g key={part.pins[index].number}>
            <circle
              className="pin-header-female-socket"
              cx={position.x}
              cy={position.y}
              r="9"
            />
            <circle
              className="pin-header-female-opening"
              cx={position.x}
              cy={position.y}
              r="4.5"
            />
          </g>
        ),
      )}
      <circle
        className="pin-one-marker"
        cx={pinPositions[0].x}
        cy={pinPositions[0].y}
        r="7"
      />
      <text className="part-reference external-label" x={centerX} y={minY - 13}>
        {part.reference}
      </text>
      <text
        className={`pin-header-gender-label pin-header-gender-${part.gender} external-label`}
        x={centerX}
        y={maxY + 18}
      >
        {part.gender === 'male' ? 'オス・ピン' : 'メス・ソケット'}
      </text>
      <text className="part-value external-label" x={centerX} y={maxY + 29}>
        {part.value}
      </text>
    </g>
  )
}
