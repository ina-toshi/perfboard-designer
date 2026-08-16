import { getWireLabel } from '../../domain/wires'
import {
  getActiveWireKind,
  getActiveWireSide,
  type EditorTool,
  type WireDraft,
} from '../../stores/editorStore'
import './WiringPanel.css'

type WireToolsProps = {
  activeTool: EditorTool
  draft: WireDraft | null
  onSelectTool: (tool: EditorTool) => void
  onCancelDraft: () => void
}

const TOOL_LABELS: Record<EditorTool, string> = {
  select: '選択ツール',
  'wire-front': '表面ジャンパー線',
  'wire-back': '裏面はんだ配線',
  'wire-back-jumper': '裏面ジャンパー線',
}

const TOOL_SHORTCUTS: Record<EditorTool, string> = {
  select: 'V',
  'wire-front': 'F',
  'wire-back': 'B',
  'wire-back-jumper': 'J',
}

const TOOL_BUTTON_LABELS: Record<
  EditorTool,
  { primary: string; secondary?: string }
> = {
  select: { primary: '選択' },
  'wire-front': { primary: 'ジャンパー線', secondary: '表面' },
  'wire-back': { primary: 'はんだ配線', secondary: '裏面' },
  'wire-back-jumper': { primary: 'ジャンパー線', secondary: '裏面' },
}

export function WireTools({
  activeTool,
  draft,
  onSelectTool,
  onCancelDraft,
}: WireToolsProps) {
  const activeSide = getActiveWireSide(activeTool)
  const activeKind = getActiveWireKind(activeTool)

  return (
    <section className="wiring-tools" aria-labelledby="editing-tools-title">
      <h2 id="editing-tools-title">編集ツール</h2>
      <div className="tool-buttons">
        {(Object.keys(TOOL_LABELS) as EditorTool[]).map((tool) => (
          <button
            key={tool}
            className={activeTool === tool ? 'is-active' : undefined}
            type="button"
            aria-pressed={activeTool === tool}
            aria-label={`${TOOL_LABELS[tool]}（${TOOL_SHORTCUTS[tool]}キー）`}
            title={TOOL_LABELS[tool]}
            onClick={() => onSelectTool(tool)}
          >
            <span className="tool-button-label">
              <span>{TOOL_BUTTON_LABELS[tool].primary}</span>
              {TOOL_BUTTON_LABELS[tool].secondary !== undefined && (
                <small>{TOOL_BUTTON_LABELS[tool].secondary}</small>
              )}
            </span>
          </button>
        ))}
      </div>
      <p className="wire-tool-status" role="status">
        現在のツール: {TOOL_LABELS[activeTool]}
        <br />
        配線面:{' '}
        {activeSide === null
          ? 'なし'
          : activeSide === 'front'
            ? '表面'
            : '裏面'}
        <br />
        種類:{' '}
        {activeKind === null
          ? 'なし'
          : activeKind === 'jumper'
            ? 'ジャンパー線'
            : 'はんだ配線'}
      </p>
      {draft !== null && (
        <div className="wire-draft-notice">
          <p>
            {getWireLabel(draft.kind, draft.side)}を作成中です。曲げたい穴をクリックし、終点をダブルクリックして確定してください。
          </p>
          <span>
            始点: 列{draft.start.column + 1}・行{draft.start.row + 1} / 設定点: {draft.points.length}点
          </span>
          <button type="button" onClick={onCancelDraft}>
            配線作成を中止
          </button>
          <span>Escapeキーでも中止できます</span>
        </div>
      )}
    </section>
  )
}
