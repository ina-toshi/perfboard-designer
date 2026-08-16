import { useEffect, useMemo, useReducer, useState } from 'react'
import { BoardCanvas } from './components/board/BoardCanvas'
import { BoardLayoutControls } from './components/board/BoardLayoutControls'
import { BoardSettings } from './components/board/BoardSettings'
import { ConnectivityPanel } from './components/connectivity/ConnectivityPanel'
import {
  RecoveryDialog,
  UnsavedChangesDialog,
} from './components/files/FileDialogs'
import { ProjectFileControls } from './components/files/ProjectFileControls'
import { SvgExportControls } from './components/files/SvgExportControls'
import { HistoryControls } from './components/history/HistoryControls'
import { NetworkPanel } from './components/nets/NetworkPanel'
import { PartPinAssignments } from './components/nets/PartPinAssignments'
import {
  InspectorTabs,
  type InspectorTab,
} from './components/panels/InspectorTabs'
import { CollapsibleSection } from './components/panels/CollapsibleSection'
import { PartInspector } from './components/parts/PartInspector'
import { PartPalette } from './components/parts/PartPalette'
import { WireInspector } from './components/wiring/WireInspector'
import { WireTools } from './components/wiring/WireTools'
import { analyzeConnectivity } from './domain/connectivity'
import {
  getConnectivityIssueKey,
  getIssueHighlight,
  getNetHighlight,
} from './domain/connectivityPresentation'
import type {
  ConfigurablePinCount,
  DipPinCount,
  PartKind,
  PinHeaderColumns,
  PinHeaderGender,
  PinHeaderNumbering,
} from './domain/parts'
import {
  DEFAULT_BOARD_VIEW_STATE,
  type DisplayMode,
  withPan,
  withZoom,
} from './domain/view'
import { useProjectFiles } from './services/useProjectFiles'
import { useSvgExport } from './services/useSvgExport'
import {
  getActiveWireSide,
  getPlacementPreviewPart,
  getSelectedPart,
  getSelectedWire,
  getWireDraftPreview,
} from './stores/editorStore'
import {
  editorHistoryReducer,
  getEditorDesignState,
  getEditorKeyboardShortcut,
  getHistoryShortcutAction,
  INITIAL_EDITOR_HISTORY_STATE,
} from './stores/editorHistory'
import {
  highlightReducer,
  INITIAL_HIGHLIGHT_STATE,
} from './stores/highlightStore'
import { getProjectDisplayName } from './stores/projectStore'
import './App.css'

const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  front: '表面',
  back: '裏面',
  overlay: '重ね合わせ',
}

const PAN_STEP = 48

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function App() {
  const [view, setView] = useState(DEFAULT_BOARD_VIEW_STATE)
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<InspectorTab>('part')
  const [highlightState, highlightDispatch] = useReducer(
    highlightReducer,
    INITIAL_HIGHLIGHT_STATE,
  )
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    INITIAL_EDITOR_HISTORY_STATE,
  )
  const editor = history.present
  const svgExport = useSvgExport(
    getEditorDesignState(editor),
    view.mirrorBack,
    view.showPartLabels,
  )
  const {
    project,
    dirty,
    busy,
    fileName,
    operationLabel,
    autoSaveLabel,
    pendingUnsavedAction,
    recoveryDraft,
    requestNewDesign,
    requestOpenDesign,
    saveCurrentDesign,
    saveBeforePendingAction,
    discardBeforePendingAction,
    cancelPendingAction,
    restoreRecoveryDraft,
    discardRecoveryDraft,
  } = useProjectFiles(history, dispatch)
  const projectDisplayName = getProjectDisplayName(
    editor.metadata.name,
    project.filePath,
  )
  const board = editor.board
  const selectedPart = getSelectedPart(editor)
  const selectedWire = getSelectedWire(editor)
  const placementPreview = getPlacementPreviewPart(editor)
  const wireDraftPreview = getWireDraftPreview(editor)
  const wireToolSide = getActiveWireSide(editor.activeTool)
  const placementActive = editor.placement !== null
  const activePaletteKind =
    editor.placement?.mode === 'new' ? editor.placement.kind : null
  const movingPart = editor.placement?.mode === 'move'
  const currentSideLabel = DISPLAY_MODE_LABELS[view.displayMode]
  const mirrorLabel = view.mirrorBack ? '左右反転して表示' : '左右反転しない'
  const connectivity = useMemo(
    () =>
      analyzeConnectivity({
        board: editor.board,
        parts: editor.parts,
        wires: editor.wires,
        nets: editor.nets,
        pinNetAssignments: editor.pinNetAssignments,
      }),
    [
      editor.board,
      editor.nets,
      editor.parts,
      editor.pinNetAssignments,
      editor.wires,
    ],
  )
  const selectedNet =
    editor.nets.find((net) => net.id === highlightState.selectedNetId) ?? null
  const selectedIssue =
    connectivity.issues.find(
      (issue) =>
        getConnectivityIssueKey(issue) === highlightState.selectedIssueKey,
    ) ?? null
  const boardHighlight =
    selectedIssue !== null
      ? getIssueHighlight(selectedIssue)
      : selectedNet !== null
        ? getNetHighlight(selectedNet, editor.pinNetAssignments, connectivity)
        : null

  useEffect(() => {
    function handleEditorKeyboard(event: KeyboardEvent) {
      if (event.isComposing) {
        return
      }

      if (view.wireInspectionActive) {
        return
      }

      if (event.key === 'Escape') {
        dispatch({ type: 'cancel-active-operation' })
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      const historyAction = getHistoryShortcutAction(event)

      if (historyAction === null) {
        const shortcut = getEditorKeyboardShortcut(event)

        if (shortcut === null) {
          return
        }

        event.preventDefault()

        switch (shortcut) {
          case 'select-tool':
            dispatch({ type: 'set-active-tool', tool: 'select' })
            return
          case 'wire-front-tool':
            dispatch({ type: 'set-active-tool', tool: 'wire-front' })
            return
          case 'wire-back-tool':
            dispatch({ type: 'set-active-tool', tool: 'wire-back' })
            return
          case 'wire-back-jumper-tool':
            dispatch({ type: 'set-active-tool', tool: 'wire-back-jumper' })
            return
          case 'rotate-selected-part':
            dispatch({ type: 'rotate-selected-part', board })
            return
          case 'delete-selected':
            if (editor.selectedPartId !== null) {
              dispatch({ type: 'delete-selected-part' })
            } else if (editor.selectedWireId !== null) {
              dispatch({ type: 'delete-selected-wire' })
            }
            return
        }
      }
      event.preventDefault()
      dispatch({ type: historyAction })
    }

    window.addEventListener('keydown', handleEditorKeyboard)
    return () => window.removeEventListener('keydown', handleEditorKeyboard)
  }, [
    board,
    editor.selectedPartId,
    editor.selectedWireId,
    view.wireInspectionActive,
  ])

  useEffect(() => {
    if (
      highlightState.selectedNetId !== null &&
      !editor.nets.some((net) => net.id === highlightState.selectedNetId)
    ) {
      highlightDispatch({ type: 'clear' })
    }
  }, [editor.nets, highlightState.selectedNetId])

  useEffect(() => {
    if (
      highlightState.selectedIssueKey !== null &&
      !connectivity.issues.some(
        (issue) =>
          getConnectivityIssueKey(issue) === highlightState.selectedIssueKey,
      )
    ) {
      highlightDispatch({ type: 'clear' })
    }
  }, [connectivity.issues, highlightState.selectedIssueKey])

  function changeZoom(delta: number) {
    setView((currentView) => withZoom(currentView, currentView.zoom + delta))
  }

  function moveBoard(delta: { x: number; y: number }) {
    setView((currentView) =>
      withPan(currentView, {
        x: currentView.pan.x + delta.x,
        y: currentView.pan.y + delta.y,
      }),
    )
  }

  function setWireInspectionActive(active: boolean) {
    setView((currentView) =>
      currentView.wireInspectionActive === active
        ? currentView
        : { ...currentView, wireInspectionActive: active },
    )
  }

  function beginPartPlacement(kind: PartKind) {
    dispatch({ type: 'begin-new-part', kind })
  }

  function commitPlacement(origin: { column: number; row: number }) {
    dispatch({
      type: 'commit-placement',
      board,
      id: crypto.randomUUID(),
      origin,
    })
  }

  function changeDipPinCount(pinCount: DipPinCount) {
    dispatch({
      type: 'change-selected-dip-pin-count',
      pinCount,
      board,
    })
  }

  return (
    <main className="designer-shell">
      <header className="app-header">
        <div className="app-branding">
          <h1>Perfboard Designer</h1>
          <p>
            {projectDisplayName}
            {dirty && <span className="dirty-indicator">未保存</span>}
          </p>
        </div>
        <dl className="board-summary">
          <div>
            <dt>基板</dt>
            <dd>
              {board.columns}列 × {board.rows}行
            </dd>
          </div>
          <div>
            <dt>穴ピッチ</dt>
            <dd>{board.pitchMm}mm</dd>
          </div>
          <div>
            <dt>部品 / 配線 / ネット</dt>
            <dd>
              {editor.parts.length}個 / {editor.wires.length}本 /{' '}
              {editor.nets.length}件
            </dd>
          </div>
        </dl>
      </header>

      <div className="designer-layout">
        <div className="side-panels">
          <aside className="control-panel" aria-label="部品と表示の設定">
            <div className="control-panel-primary">
              <ProjectFileControls
                designName={editor.metadata.name}
                fileName={fileName}
                dirty={dirty}
                busy={busy}
                operationLabel={operationLabel}
                autoSaveLabel={autoSaveLabel}
                message={project.message}
                error={project.error}
                onChangeDesignName={(name) =>
                  dispatch({ type: 'change-design-name', name })
                }
                onNew={requestNewDesign}
                onOpen={requestOpenDesign}
                onSave={() => void saveCurrentDesign(false)}
                onSaveAs={() => void saveCurrentDesign(true)}
              />

              <HistoryControls
                undoCount={history.past.length}
                redoCount={history.future.length}
                onUndo={() => dispatch({ type: 'undo' })}
                onRedo={() => dispatch({ type: 'redo' })}
              />

              <WireTools
                activeTool={editor.activeTool}
                draft={editor.wireDraft}
                onSelectTool={(tool) =>
                  dispatch({ type: 'set-active-tool', tool })
                }
                onCancelDraft={() => dispatch({ type: 'cancel-wire-draft' })}
              />

              <section
                className="display-controls"
                aria-labelledby="display-title"
              >
                <h2 id="display-title">表示面</h2>
                <div
                  className="mode-buttons"
                  role="group"
                  aria-label="表示面の切り替え"
                >
                  {(Object.keys(DISPLAY_MODE_LABELS) as DisplayMode[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        className={
                          view.displayMode === mode ? 'is-active' : undefined
                        }
                        type="button"
                        aria-pressed={view.displayMode === mode}
                        onClick={() =>
                          setView((currentView) => ({
                            ...currentView,
                            displayMode: mode,
                          }))
                        }
                      >
                        {DISPLAY_MODE_LABELS[mode]}
                      </button>
                    ),
                  )}
                </div>
                <label className="toggle-control">
                  <input
                    type="checkbox"
                    checked={view.mirrorBack}
                    onChange={(event) =>
                      setView((currentView) => ({
                        ...currentView,
                        mirrorBack: event.target.checked,
                      }))
                    }
                  />
                  裏面を左右反転して表示
                </label>
                <label className="toggle-control">
                  <input
                    type="checkbox"
                    checked={view.showPartLabels}
                    onChange={(event) =>
                      setView((currentView) => ({
                        ...currentView,
                        showPartLabels: event.target.checked,
                      }))
                    }
                  />
                  部品ラベルを表示
                </label>
                <div className="wire-inspection-control">
                  <button
                    className={
                      view.wireInspectionActive ? 'is-active' : undefined
                    }
                    type="button"
                    aria-pressed={view.wireInspectionActive}
                    aria-describedby="wire-inspection-description"
                    title="押している間だけ、配線を部品より手前に表示します"
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return
                      }

                      event.currentTarget.setPointerCapture(event.pointerId)
                      setWireInspectionActive(true)
                    }}
                    onPointerUp={() => setWireInspectionActive(false)}
                    onPointerCancel={() => setWireInspectionActive(false)}
                    onLostPointerCapture={() => setWireInspectionActive(false)}
                    onBlur={() => setWireInspectionActive(false)}
                    onKeyDown={(event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault()
                        setWireInspectionActive(true)
                      }
                    }}
                    onKeyUp={(event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault()
                        setWireInspectionActive(false)
                      }
                    }}
                  >
                    押している間、配線を手前に表示
                  </button>
                  <p id="wire-inspection-description">
                    確認専用です。押している間は基板上を編集できません。
                  </p>
                </div>
              </section>

              {editor.error !== null && (
                <p className="editor-error" role="alert">
                  {editor.error}
                </p>
              )}
            </div>

            <CollapsibleSection title="部品パレット" defaultOpen>
              <PartPalette
                activeKind={activePaletteKind}
                movingPart={movingPart}
                showTitle={false}
                onChoosePart={beginPartPlacement}
                onCancelPlacement={() => dispatch({ type: 'cancel-placement' })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="基板と配置">
              <div className="board-layout-settings">
                <BoardSettings
                  board={board}
                  showTitle={false}
                  onApply={(nextBoard) =>
                    dispatch({ type: 'change-board', board: nextBoard })
                  }
                />
                <BoardLayoutControls
                  disabled={placementActive || editor.wireDraft !== null}
                  showTitle={false}
                  onMove={(offset) => dispatch({ type: 'move-layout', offset })}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="組み立て図の出力">
              <SvgExportControls
                mirrorBack={view.mirrorBack}
                showPartLabels={view.showPartLabels}
                busy={svgExport.busy}
                disabled={busy}
                showTitle={false}
                message={svgExport.message}
                error={svgExport.error}
                onExportFront={() => void svgExport.exportFrontSvg()}
                onExportBack={() => void svgExport.exportBackSvg()}
              />
            </CollapsibleSection>

            <CollapsibleSection title="表示の詳細">
              <section aria-labelledby="zoom-title">
                <h2 id="zoom-title">表示倍率</h2>
                <p className="zoom-value">{Math.round(view.zoom * 100)}%</p>
                <div className="control-row">
                  <button type="button" onClick={() => changeZoom(-0.1)}>
                    縮小
                  </button>
                  <button type="button" onClick={() => changeZoom(0.1)}>
                    拡大
                  </button>
                </div>
              </section>

              <section className="pan-section" aria-labelledby="pan-title">
                <h2 id="pan-title">表示範囲</h2>
                <div className="pan-controls" aria-label="表示範囲を移動">
                  <button
                    className="pan-up"
                    type="button"
                    aria-label="上へ移動"
                    onClick={() => moveBoard({ x: 0, y: PAN_STEP })}
                  >
                    ↑
                  </button>
                  <button
                    className="pan-left"
                    type="button"
                    aria-label="左へ移動"
                    onClick={() => moveBoard({ x: PAN_STEP, y: 0 })}
                  >
                    ←
                  </button>
                  <button
                    className="pan-right"
                    type="button"
                    aria-label="右へ移動"
                    onClick={() => moveBoard({ x: -PAN_STEP, y: 0 })}
                  >
                    →
                  </button>
                  <button
                    className="pan-down"
                    type="button"
                    aria-label="下へ移動"
                    onClick={() => moveBoard({ x: 0, y: -PAN_STEP })}
                  >
                    ↓
                  </button>
                </div>
                <button
                  className="reset-button"
                  type="button"
                  onClick={() => setView(DEFAULT_BOARD_VIEW_STATE)}
                >
                  表示をリセット
                </button>
              </section>

              <p className="view-status" role="status">
                現在の表示: {currentSideLabel} / 裏面は{mirrorLabel}
              </p>
            </CollapsibleSection>
          </aside>

          <InspectorTabs
            activeTab={activeInspectorTab}
            highlightLabel={boardHighlight?.label ?? null}
            onChangeTab={setActiveInspectorTab}
            onClearHighlight={() => highlightDispatch({ type: 'clear' })}
          >
            {activeInspectorTab === 'part' && (
              <>
                <PartInspector
                  part={selectedPart}
                  onApplySettings={({ reference, value }) =>
                    dispatch({
                      type: 'update-selected-settings',
                      reference,
                      value,
                    })
                  }
                  onChangeDipPinCount={changeDipPinCount}
                  onChangeCapacitorPolarity={(polarized) =>
                    dispatch({
                      type: 'change-selected-capacitor-polarity',
                      polarized,
                    })
                  }
                  onChangeLedColor={(color) =>
                    dispatch({ type: 'change-selected-led-color', color })
                  }
                  onChangePinHeaderColumns={(columns: PinHeaderColumns) =>
                    dispatch({
                      type: 'change-selected-pin-header-columns',
                      columns,
                      board,
                    })
                  }
                  onChangePinHeaderGender={(gender: PinHeaderGender) =>
                    dispatch({
                      type: 'change-selected-pin-header-gender',
                      gender,
                    })
                  }
                  onChangePinHeaderNumbering={(numbering: PinHeaderNumbering) =>
                    dispatch({
                      type: 'change-selected-pin-header-numbering',
                      numbering,
                    })
                  }
                  onChangePinCount={(pinCount: ConfigurablePinCount) =>
                    dispatch({
                      type: 'change-selected-pin-count',
                      pinCount,
                      board,
                    })
                  }
                  onRotate={() =>
                    dispatch({
                      type: 'rotate-selected-part',
                      board,
                    })
                  }
                  onDelete={() => dispatch({ type: 'delete-selected-part' })}
                />
                {selectedPart !== null && (
                  <PartPinAssignments
                    part={selectedPart}
                    nets={editor.nets}
                    assignments={editor.pinNetAssignments}
                    onAssign={(partId, pinNumber, netId) =>
                      dispatch({
                        type: 'assign-pin-net',
                        partId,
                        pinNumber,
                        netId,
                      })
                    }
                    onUnassign={(partId, pinNumber) =>
                      dispatch({
                        type: 'unassign-pin-net',
                        partId,
                        pinNumber,
                      })
                    }
                    onAssignTactileSwitchGroup={(partId, group, netId) =>
                      dispatch({
                        type: 'assign-tactile-switch-group-net',
                        partId,
                        group,
                        netId,
                      })
                    }
                    onUnassignTactileSwitchGroup={(partId, group) =>
                      dispatch({
                        type: 'unassign-tactile-switch-group-net',
                        partId,
                        group,
                      })
                    }
                  />
                )}
              </>
            )}
            {activeInspectorTab === 'wire' &&
              (selectedWire === null ? (
                <section className="inspector-tab-empty">
                  <h2>選択中の配線</h2>
                  <p>選択ツールで基板上の配線を選択してください。</p>
                </section>
              ) : (
                <WireInspector
                  wire={selectedWire}
                  onChangeColor={(color) =>
                    dispatch({ type: 'change-selected-wire-color', color })
                  }
                  onChangeKind={(kind) =>
                    dispatch({ type: 'change-selected-wire-kind', kind })
                  }
                  onChangeSide={(side) =>
                    dispatch({ type: 'change-selected-wire-side', side })
                  }
                  onDelete={() => dispatch({ type: 'delete-selected-wire' })}
                />
              ))}
            {activeInspectorTab === 'net' && (
              <NetworkPanel
                nets={editor.nets}
                assignments={editor.pinNetAssignments}
                analysis={connectivity}
                selectedNetId={highlightState.selectedNetId}
                error={editor.error}
                onCreate={({ name, kind, color }) =>
                  dispatch({
                    type: 'create-net',
                    id: crypto.randomUUID(),
                    name,
                    kind,
                    color,
                  })
                }
                onUpdate={(netId, { name, kind, color }) =>
                  dispatch({
                    type: 'update-net',
                    netId,
                    name,
                    kind,
                    color,
                  })
                }
                onDelete={(netId) => {
                  dispatch({ type: 'delete-net', netId })
                  highlightDispatch({ type: 'clear' })
                }}
                onSelect={(netId) =>
                  highlightDispatch({ type: 'toggle-net', netId })
                }
              />
            )}
            {activeInspectorTab === 'connectivity' && (
              <ConnectivityPanel
                analysis={connectivity}
                nets={editor.nets}
                assignments={editor.pinNetAssignments}
                parts={editor.parts}
                selectedNetId={highlightState.selectedNetId}
                selectedIssueKey={highlightState.selectedIssueKey}
                onSelectIssue={(issueKey) =>
                  highlightDispatch({ type: 'toggle-issue', issueKey })
                }
              />
            )}
          </InspectorTabs>
        </div>

        <BoardCanvas
          board={board}
          view={view}
          parts={editor.parts}
          wires={editor.wires}
          selectedPartId={editor.selectedPartId}
          selectedWireId={editor.selectedWireId}
          placementPreview={placementPreview}
          placementActive={placementActive}
          wireToolSide={wireToolSide}
          wireDraftPreview={wireDraftPreview}
          wireDraftActive={editor.wireDraft !== null}
          highlight={boardHighlight}
          onPan={moveBoard}
          onZoom={changeZoom}
          onGridHover={(origin) =>
            dispatch({ type: 'set-placement-preview', origin })
          }
          onWireHover={(end) => dispatch({ type: 'set-wire-preview', end })}
          onGridClick={commitPlacement}
          onWireGridClick={(point) =>
            dispatch({
              type: 'wire-point-click',
              board,
              id: crypto.randomUUID(),
              point,
            })
          }
          onSelectPart={(partId) => {
            dispatch({ type: 'select-part', partId })
            setActiveInspectorTab('part')
          }}
          onSelectWire={(wireId) => {
            dispatch({ type: 'select-wire', wireId })
            setActiveInspectorTab('wire')
          }}
          onMovePart={(partId, offset) =>
            dispatch({ type: 'move-part-by-offset', partId, offset })
          }
          onMoveWire={(wireId, offset) =>
            dispatch({ type: 'move-wire-by-offset', wireId, offset })
          }
          onMoveWireEndpoint={(wireId, endpointIndex, point) =>
            dispatch({
              type: 'move-wire-endpoint',
              wireId,
              endpointIndex,
              point,
            })
          }
          onClearSelection={() =>
            dispatch({ type: 'select-part', partId: null })
          }
        />
      </div>

      {pendingUnsavedAction !== null && (
        <UnsavedChangesDialog
          action={pendingUnsavedAction}
          busy={busy}
          onSave={() => void saveBeforePendingAction()}
          onDiscard={() => void discardBeforePendingAction()}
          onCancel={cancelPendingAction}
        />
      )}

      {recoveryDraft !== null && (
        <RecoveryDialog
          savedAt={recoveryDraft.savedAt}
          designName={recoveryDraft.design.metadata.name}
          busy={busy}
          onRestore={() => void restoreRecoveryDraft()}
          onDiscard={() => void discardRecoveryDraft()}
        />
      )}
    </main>
  )
}

export default App
