import type { SvgPoint } from '../../domain/coordinates'
import { LED_COLOR_HEX, type LedPart } from '../../domain/parts'

type LedPartViewProps = {
  part: LedPart
  pinPositions: SvgPoint[]
}

export function LedPartView({ part, pinPositions }: LedPartViewProps) {
  const [anode, cathode] = pinPositions
  const center = {
    x: (anode.x + cathode.x) / 2,
    y: (anode.y + cathode.y) / 2,
  }

  return (
    <g>
      <line
        className="part-lead"
        x1={anode.x}
        y1={anode.y}
        x2={cathode.x}
        y2={cathode.y}
      />
      <circle
        className="led-body"
        cx={center.x}
        cy={center.y}
        r="12"
        fill={LED_COLOR_HEX[part.color]}
      />
      <path
        className="led-polarity"
        d={`M ${center.x + 6.5} ${center.y - 7.5} L ${center.x + 6.5} ${
          center.y + 7.5
        }`}
      />
      <text className="part-reference" x={center.x} y={center.y - 18}>
        {part.reference}
      </text>
      <text className="part-value" x={center.x} y={center.y + 3}>
        {part.value}
      </text>
    </g>
  )
}
