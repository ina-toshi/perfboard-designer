import type { SvgPoint } from '../../domain/coordinates'
import type { DiodePart } from '../../domain/parts'

type DiodePartViewProps = {
  part: DiodePart
  pinPositions: SvgPoint[]
}

export function DiodePartView({ part, pinPositions }: DiodePartViewProps) {
  const [anode, cathode] = pinPositions
  const length = Math.hypot(cathode.x - anode.x, cathode.y - anode.y)
  const angle =
    (Math.atan2(cathode.y - anode.y, cathode.x - anode.x) * 180) / Math.PI

  return (
    <g transform={`translate(${anode.x} ${anode.y}) rotate(${angle})`}>
      <line className="part-lead" x1="0" y1="0" x2={length} y2="0" />
      <rect
        className="diode-body"
        x={length * 0.25}
        y="-7"
        width={length * 0.5}
        height="14"
        rx="3"
      />
      <line
        className="diode-cathode-band"
        x1={length * 0.65}
        y1="-7"
        x2={length * 0.65}
        y2="7"
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
