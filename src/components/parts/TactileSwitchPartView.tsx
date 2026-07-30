import type { SvgPoint } from '../../domain/coordinates'
import type { TactileSwitchPart } from '../../domain/parts'

const PX_PER_MM = 24 / 2.54
const TACTILE_SWITCH_SIZE_MM = 6

type TactileSwitchPartViewProps = {
  part: TactileSwitchPart
  pinPositions: SvgPoint[]
}

export function TactileSwitchPartView({
  part,
  pinPositions,
}: TactileSwitchPartViewProps) {
  const xValues = pinPositions.map((point) => point.x)
  const yValues = pinPositions.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const bodySize = TACTILE_SWITCH_SIZE_MM * PX_PER_MM
  const buttonRadius = bodySize / 4

  return (
    <g>
      <rect
        className="tactile-switch-body"
        x={centerX - bodySize / 2}
        y={centerY - bodySize / 2}
        width={bodySize}
        height={bodySize}
        rx={bodySize * 0.08}
      />
      <circle
        className="tactile-switch-button"
        cx={centerX}
        cy={centerY}
        r={buttonRadius}
      />
      <text
        className="part-reference"
        x={centerX}
        y={centerY - bodySize / 2 - 6}
      >
        {part.reference}
      </text>
      <text className="part-value" x={centerX} y={centerY + bodySize / 2 + 12}>
        {part.value}
      </text>
    </g>
  )
}
