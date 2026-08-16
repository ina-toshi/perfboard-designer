import type { Board, GridOffset, GridPoint } from '../domain/board'
import {
  DEFAULT_BOARD,
  isGridPointWithinBoard,
  offsetGridPoint,
} from '../domain/board'
import {
  createDefaultDesignMetadata,
  type DesignMetadata,
} from '../domain/design'
import {
  createPart,
  generatePartReference,
  getNextRotation,
  isPartWithinBoard,
  TACTILE_SWITCH_PIN_GROUPS,
  withDipPinCount,
  withLedColor,
  withCapacitorPolarity,
  withConnectorPinCount,
  withPartOrigin,
  withPartRotation,
  withPartSettings,
  withPinHeaderConfiguration,
  withPinHeaderGender,
  withPinHeaderNumbering,
  type ConfigurablePinCount,
  type DipPinCount,
  type LedColor,
  type Part,
  type PartKind,
  type PinHeaderColumns,
  type PinHeaderGender,
  type PinHeaderNumbering,
  type TactileSwitchGroup,
} from '../domain/parts'
import {
  getNetNameKey,
  hasPartPin,
  isValidNetColor,
  normalizeNetName,
  prunePinNetAssignments,
  type Net,
  type NetKind,
  type PinNetAssignment,
} from '../domain/nets'
import {
  areGridPointsEqual,
  createWireFromPoints,
  DEFAULT_WIRE_COLORS,
  isWireWithinBoard,
  isZeroLengthWire,
  withWireColor,
  withWireKind,
  withWireSide,
  type Wire,
  type WireKind,
  type WireSide,
} from '../domain/wires'

export type EditorTool =
  'select' | 'wire-front' | 'wire-back' | 'wire-back-jumper'

export type WireDraft = {
  side: WireSide
  kind: WireKind
  start: GridPoint
  points: GridPoint[]
  previewEnd: GridPoint | null
  color: string
}

export type PlacementState =
  | {
      mode: 'new'
      kind: PartKind
      previewOrigin: GridPoint | null
    }
  | {
      mode: 'move'
      partId: string
      previewOrigin: GridPoint | null
    }

export type EditorDesignState = {
  metadata: DesignMetadata
  board: Board
  parts: Part[]
  wires: Wire[]
  nets: Net[]
  pinNetAssignments: PinNetAssignment[]
}

export type EditorTransientState = {
  selectedPartId: string | null
  selectedWireId: string | null
  activeTool: EditorTool
  placement: PlacementState | null
  wireDraft: WireDraft | null
  error: string | null
}

export type EditorState = EditorDesignState & EditorTransientState

export const INITIAL_EDITOR_STATE: EditorState = {
  metadata: createDefaultDesignMetadata(),
  board: DEFAULT_BOARD,
  parts: [],
  wires: [],
  nets: [],
  pinNetAssignments: [],
  selectedPartId: null,
  selectedWireId: null,
  activeTool: 'select',
  placement: null,
  wireDraft: null,
  error: null,
}

export type EditorAction =
  | { type: 'change-design-name'; name: string }
  | { type: 'change-board'; board: Board }
  | { type: 'move-layout'; offset: GridOffset }
  | { type: 'move-part-by-offset'; partId: string; offset: GridOffset }
  | { type: 'move-wire-by-offset'; wireId: string; offset: GridOffset }
  | {
      type: 'move-wire-endpoint'
      wireId: string
      endpointIndex: 0 | 1
      point: GridPoint
    }
  | { type: 'begin-new-part'; kind: PartKind }
  | { type: 'begin-move-part'; partId: string }
  | { type: 'set-placement-preview'; origin: GridPoint | null }
  | { type: 'cancel-placement' }
  | { type: 'set-active-tool'; tool: EditorTool }
  | { type: 'set-wire-preview'; end: GridPoint | null }
  | {
      type: 'wire-point-click'
      board: Board
      id: string
      point: GridPoint
    }
  | { type: 'cancel-wire-draft' }
  | { type: 'cancel-active-operation' }
  | {
      type: 'commit-placement'
      board: Board
      id: string
      origin: GridPoint
    }
  | { type: 'select-part'; partId: string | null }
  | { type: 'select-wire'; wireId: string | null }
  | { type: 'rotate-selected-part'; board: Board }
  | { type: 'delete-selected-part' }
  | { type: 'delete-selected-wire' }
  | { type: 'change-selected-wire-color'; color: string }
  | { type: 'change-selected-wire-side'; side: WireSide }
  | { type: 'change-selected-wire-kind'; kind: WireKind }
  | {
      type: 'update-selected-settings'
      reference: string
      value: string
    }
  | {
      type: 'change-selected-dip-pin-count'
      pinCount: DipPinCount
      board: Board
    }
  | {
      type: 'change-selected-capacitor-polarity'
      polarized: boolean
    }
  | { type: 'change-selected-led-color'; color: LedColor }
  | {
      type: 'change-selected-pin-header-columns'
      columns: PinHeaderColumns
      board: Board
    }
  | {
      type: 'change-selected-pin-header-gender'
      gender: PinHeaderGender
    }
  | {
      type: 'change-selected-pin-header-numbering'
      numbering: PinHeaderNumbering
    }
  | {
      type: 'change-selected-pin-count'
      pinCount: ConfigurablePinCount
      board: Board
    }
  | {
      type: 'create-net'
      id: string
      name: string
      kind: NetKind
      color?: string
    }
  | {
      type: 'update-net'
      netId: string
      name: string
      kind: NetKind
      color?: string
    }
  | { type: 'delete-net'; netId: string }
  | {
      type: 'assign-pin-net'
      partId: string
      pinNumber: string
      netId: string
    }
  | {
      type: 'assign-tactile-switch-group-net'
      partId: string
      group: TactileSwitchGroup
      netId: string
    }
  | { type: 'unassign-pin-net'; partId: string; pinNumber: string }
  | {
      type: 'unassign-tactile-switch-group-net'
      partId: string
      group: TactileSwitchGroup
    }
  | { type: 'clear-error' }

export function getSelectedPart(state: EditorState): Part | null {
  return state.parts.find((part) => part.id === state.selectedPartId) ?? null
}

export function getSelectedWire(state: EditorState): Wire | null {
  return state.wires.find((wire) => wire.id === state.selectedWireId) ?? null
}

export function getActiveWireSide(tool: EditorTool): WireSide | null {
  switch (tool) {
    case 'wire-front':
      return 'front'
    case 'wire-back':
    case 'wire-back-jumper':
      return 'back'
    case 'select':
      return null
  }
}

export function getActiveWireKind(tool: EditorTool): WireKind | null {
  switch (tool) {
    case 'wire-front':
    case 'wire-back-jumper':
      return 'jumper'
    case 'wire-back':
      return 'solder'
    case 'select':
      return null
  }
}

export function getWireDraftPreview(state: EditorState): Wire | null {
  const draft = state.wireDraft

  if (draft === null || draft.previewEnd === null) {
    return null
  }

  const lastPoint = draft.points[draft.points.length - 1]
  const previewPoints =
    lastPoint !== undefined && areGridPointsEqual(lastPoint, draft.previewEnd)
      ? draft.points
      : [...draft.points, draft.previewEnd]

  return previewPoints.length < 2
    ? null
    : createWireFromPoints(
        'wire-draft-preview',
        draft.side,
        previewPoints,
        draft.color,
        draft.kind,
      )
}

export function getPlacementPreviewPart(state: EditorState): Part | null {
  const placement = state.placement

  if (placement?.previewOrigin === null || placement === null) {
    return null
  }

  if (placement.mode === 'new') {
    return createPart(
      placement.kind,
      'placement-preview',
      generatePartReference(placement.kind, state.parts),
      placement.previewOrigin,
    )
  }

  const part = state.parts.find(
    (candidate) => candidate.id === placement.partId,
  )
  return part === undefined
    ? null
    : withPartOrigin(part, placement.previewOrigin)
}

function replacePart(state: EditorState, replacement: Part): EditorState {
  const parts = state.parts.map((part) =>
    part.id === replacement.id ? replacement : part,
  )

  return {
    ...state,
    parts,
    pinNetAssignments: prunePinNetAssignments(state.pinNetAssignments, parts),
    error: null,
  }
}

function getPinOffsetKey(pin: Part['pins'][number]): string {
  return `${pin.offset.column},${pin.offset.row}`
}

function remapPinHeaderAssignments(
  assignments: PinNetAssignment[],
  previousPart: Extract<Part, { kind: 'pin-header' }>,
  nextPart: Extract<Part, { kind: 'pin-header' }>,
): PinNetAssignment[] {
  const offsetsByPreviousNumber = new Map(
    previousPart.pins.map((pin) => [pin.number, getPinOffsetKey(pin)]),
  )
  const nextNumbersByOffset = new Map(
    nextPart.pins.map((pin) => [getPinOffsetKey(pin), pin.number]),
  )

  return assignments.map((assignment) => {
    if (assignment.partId !== previousPart.id) {
      return assignment
    }

    const offset = offsetsByPreviousNumber.get(assignment.pinNumber)
    const pinNumber =
      offset === undefined
        ? assignment.pinNumber
        : (nextNumbersByOffset.get(offset) ?? assignment.pinNumber)

    return { ...assignment, pinNumber }
  })
}

function replaceWire(state: EditorState, replacement: Wire): EditorState {
  return {
    ...state,
    wires: state.wires.map((wire) =>
      wire.id === replacement.id ? replacement : wire,
    ),
    error: null,
  }
}

function replacePartWithinBoard(
  state: EditorState,
  replacement: Part,
  board: Board,
): EditorState {
  return isPartWithinBoard(replacement, board)
    ? replacePart(state, replacement)
    : {
        ...state,
        error: '端子設定を変更すると基板外へはみ出すため操作できません。',
      }
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'change-design-name': {
      const name = action.name.trim()

      if (name.length === 0) {
        return { ...state, error: '設計名を入力してください。' }
      }
      if (state.metadata.name === name) {
        return { ...state, error: null }
      }

      return {
        ...state,
        metadata: { ...state.metadata, name },
        error: null,
      }
    }

    case 'change-board': {
      const board = action.board
      const validDimensions =
        Number.isInteger(board.columns) &&
        board.columns > 0 &&
        Number.isInteger(board.rows) &&
        board.rows > 0

      if (!validDimensions) {
        return { ...state, error: '基板の列数と行数は正の整数にしてください。' }
      }
      if (
        state.parts.some((part) => !isPartWithinBoard(part, board)) ||
        state.wires.some((wire) => !isWireWithinBoard(wire, board))
      ) {
        return {
          ...state,
          error: '配置済みの部品または配線が基板外になるため変更できません。',
        }
      }
      if (
        state.board.columns === board.columns &&
        state.board.rows === board.rows &&
        state.board.pitchMm === board.pitchMm
      ) {
        return { ...state, error: null }
      }

      return { ...state, board: { ...board }, error: null }
    }

    case 'move-layout': {
      const { offset } = action

      if (
        !Number.isInteger(offset.column) ||
        !Number.isInteger(offset.row) ||
        (offset.column === 0 && offset.row === 0)
      ) {
        return {
          ...state,
          error: '移動量は1マス以上の整数で指定してください。',
        }
      }
      if (state.placement !== null || state.wireDraft !== null) {
        return {
          ...state,
          error:
            '部品の配置または配線の作成を完了・中止してから全体を移動してください。',
        }
      }
      if (state.parts.length === 0 && state.wires.length === 0) {
        return { ...state, error: '移動する部品または配線がありません。' }
      }

      const parts = state.parts.map((part) =>
        withPartOrigin(part, offsetGridPoint(part.origin, offset)),
      )
      const wires = state.wires.map((wire) => ({
        ...wire,
        points: wire.points.map((point) => offsetGridPoint(point, offset)),
      }))

      if (
        parts.some((part) => !isPartWithinBoard(part, state.board)) ||
        wires.some((wire) => !isWireWithinBoard(wire, state.board))
      ) {
        return {
          ...state,
          error: '基板外へはみ出すため、配置全体を移動できません。',
        }
      }

      return { ...state, parts, wires, error: null }
    }

    case 'move-part-by-offset': {
      if (action.offset.column === 0 && action.offset.row === 0) {
        return state
      }

      const part = state.parts.find((item) => item.id === action.partId)

      if (part === undefined) {
        return { ...state, error: '移動する部品が見つかりません。' }
      }

      const movedPart = withPartOrigin(
        part,
        offsetGridPoint(part.origin, action.offset),
      )

      return isPartWithinBoard(movedPart, state.board)
        ? replacePart(state, movedPart)
        : { ...state, error: '部品が基板外へ出るため移動できません。' }
    }

    case 'move-wire-by-offset': {
      if (action.offset.column === 0 && action.offset.row === 0) {
        return state
      }

      const wire = state.wires.find((item) => item.id === action.wireId)

      if (wire === undefined) {
        return { ...state, error: '移動する配線が見つかりません。' }
      }

      const movedWire = {
        ...wire,
        points: wire.points.map((point) =>
          offsetGridPoint(point, action.offset),
        ),
      }

      return isWireWithinBoard(movedWire, state.board)
        ? replaceWire(state, movedWire)
        : { ...state, error: '配線が基板外へ出るため移動できません。' }
    }

    case 'move-wire-endpoint': {
      const wire = state.wires.find((item) => item.id === action.wireId)

      if (wire === undefined) {
        return { ...state, error: '移動する配線が見つかりません。' }
      }

      const targetIndex = action.endpointIndex === 0 ? 0 : wire.points.length - 1
      const currentPoint = wire.points[targetIndex]

      if (
        currentPoint !== undefined &&
        currentPoint.column === action.point.column &&
        currentPoint.row === action.point.row
      ) {
        return state
      }

      const movedWire = {
        ...wire,
        points: wire.points.map((point, index) =>
          index === targetIndex ? { ...action.point } : point,
        ),
      }

      if (!isWireWithinBoard(movedWire, state.board)) {
        return { ...state, error: '配線の端点を基板内の穴へ置いてください。' }
      }
      if (isZeroLengthWire(movedWire)) {
        return { ...state, error: '始点と終点は異なる穴へ置いてください。' }
      }

      return replaceWire(state, movedWire)
    }

    case 'begin-new-part':
      return {
        ...state,
        activeTool: 'select',
        selectedWireId: null,
        wireDraft: null,
        placement: {
          mode: 'new',
          kind: action.kind,
          previewOrigin: null,
        },
        error: null,
      }

    case 'begin-move-part':
      if (
        state.activeTool !== 'select' ||
        !state.parts.some((part) => part.id === action.partId)
      ) {
        return state
      }
      return {
        ...state,
        selectedPartId: action.partId,
        selectedWireId: null,
        placement: {
          mode: 'move',
          partId: action.partId,
          previewOrigin: null,
        },
        error: null,
      }

    case 'set-placement-preview':
      if (state.placement === null) {
        return state
      }
      return {
        ...state,
        placement: { ...state.placement, previewOrigin: action.origin },
      }

    case 'cancel-placement':
      return { ...state, placement: null, error: null }

    case 'set-active-tool':
      return {
        ...state,
        activeTool: action.tool,
        placement: null,
        wireDraft: null,
        selectedPartId: action.tool === 'select' ? state.selectedPartId : null,
        error: null,
      }

    case 'set-wire-preview':
      if (state.wireDraft === null) {
        return state
      }
      return {
        ...state,
        wireDraft: { ...state.wireDraft, previewEnd: action.end },
      }

    case 'wire-point-click': {
      const side = getActiveWireSide(state.activeTool)
      const kind = getActiveWireKind(state.activeTool)

      if (side === null || kind === null) {
        return {
          ...state,
          error: '表面または裏面の配線ツールを選択してください。',
        }
      }
      if (!isGridPointWithinBoard(action.point, action.board)) {
        return {
          ...state,
          error: '基板内の穴を選んでください。',
        }
      }
      if (state.wireDraft === null) {
        return {
          ...state,
          selectedPartId: null,
          selectedWireId: null,
          wireDraft: {
            side,
            kind,
            start: action.point,
            points: [{ ...action.point }],
            previewEnd: action.point,
            color: DEFAULT_WIRE_COLORS[kind],
          },
          error: null,
        }
      }

      const lastPoint = state.wireDraft.points[state.wireDraft.points.length - 1]

      if (lastPoint !== undefined && areGridPointsEqual(lastPoint, action.point)) {
        if (state.wireDraft.points.length < 2) {
          return {
            ...state,
            error: '始点と異なる穴を選んでください。',
          }
        }

        const wire = createWireFromPoints(
          action.id,
          state.wireDraft.side,
          state.wireDraft.points,
          state.wireDraft.color,
          state.wireDraft.kind,
        )

        if (!isWireWithinBoard(wire, action.board)) {
          return {
            ...state,
            error: '配線の各点を基板内の穴へ置いてください。',
          }
        }
        if (isZeroLengthWire(wire)) {
          return {
            ...state,
            error: '配線には異なる穴を2点以上指定してください。',
          }
        }

        return {
          ...state,
          wires: [...state.wires, wire],
          selectedPartId: null,
          selectedWireId: wire.id,
          wireDraft: null,
          error: null,
        }
      }

      return {
        ...state,
        wireDraft: {
          ...state.wireDraft,
          points: [...state.wireDraft.points, { ...action.point }],
          previewEnd: action.point,
        },
        error: null,
      }
    }

    case 'cancel-wire-draft':
      return { ...state, wireDraft: null, error: null }

    case 'cancel-active-operation':
      return {
        ...state,
        placement: null,
        wireDraft: null,
        error: null,
      }

    case 'commit-placement': {
      const stateAtClickedOrigin =
        state.placement === null
          ? state
          : {
              ...state,
              placement: {
                ...state.placement,
                previewOrigin: action.origin,
              },
            }
      const preview = getPlacementPreviewPart(stateAtClickedOrigin)

      if (preview === null || !isPartWithinBoard(preview, action.board)) {
        return {
          ...state,
          error: '部品が基板内に収まる位置を選んでください。',
        }
      }

      if (state.placement?.mode === 'new') {
        const part = { ...preview, id: action.id }
        return {
          ...state,
          parts: [...state.parts, part],
          selectedPartId: part.id,
          selectedWireId: null,
          placement: null,
          error: null,
        }
      }

      return {
        ...replacePart(state, preview),
        selectedPartId: preview.id,
        placement: null,
      }
    }

    case 'select-part':
      if (state.activeTool !== 'select') {
        return state
      }
      return {
        ...state,
        selectedPartId: action.partId,
        selectedWireId: null,
        placement: null,
        wireDraft: null,
        error: null,
      }

    case 'select-wire':
      if (state.activeTool !== 'select') {
        return state
      }
      return {
        ...state,
        selectedPartId: null,
        selectedWireId: action.wireId,
        placement: null,
        wireDraft: null,
        error: null,
      }

    case 'rotate-selected-part': {
      const selectedPart = getSelectedPart(state)

      if (selectedPart === null) {
        return state
      }

      const rotatedPart = withPartRotation(
        selectedPart,
        getNextRotation(selectedPart.rotation),
      )

      return isPartWithinBoard(rotatedPart, action.board)
        ? replacePart(state, rotatedPart)
        : {
            ...state,
            error: '回転すると基板外へはみ出すため操作できません。',
          }
    }

    case 'delete-selected-part':
      if (state.selectedPartId === null) {
        return state
      }
      return {
        ...state,
        parts: state.parts.filter((part) => part.id !== state.selectedPartId),
        pinNetAssignments: state.pinNetAssignments.filter(
          (assignment) => assignment.partId !== state.selectedPartId,
        ),
        selectedPartId: null,
        placement: null,
        error: null,
      }

    case 'delete-selected-wire':
      if (state.selectedWireId === null) {
        return state
      }
      return {
        ...state,
        wires: state.wires.filter((wire) => wire.id !== state.selectedWireId),
        selectedWireId: null,
        wireDraft: null,
        error: null,
      }

    case 'change-selected-wire-color': {
      const selectedWire = getSelectedWire(state)
      const color = action.color.trim()

      if (selectedWire === null) {
        return state
      }
      if (color.length === 0) {
        return { ...state, error: '配線色を選択してください。' }
      }

      return replaceWire(state, withWireColor(selectedWire, color))
    }

    case 'change-selected-wire-side': {
      const selectedWire = getSelectedWire(state)

      return selectedWire === null
        ? state
        : replaceWire(state, withWireSide(selectedWire, action.side))
    }

    case 'change-selected-wire-kind': {
      const selectedWire = getSelectedWire(state)
      return selectedWire === null
        ? state
        : replaceWire(state, withWireKind(selectedWire, action.kind))
    }

    case 'update-selected-settings': {
      const selectedPart = getSelectedPart(state)
      const reference = action.reference.trim()

      if (selectedPart === null) {
        return state
      }
      if (reference.length === 0) {
        return { ...state, error: '部品番号を入力してください。' }
      }
      if (
        state.parts.some(
          (part) =>
            part.id !== selectedPart.id &&
            part.reference.toLocaleUpperCase() ===
              reference.toLocaleUpperCase(),
        )
      ) {
        return { ...state, error: '同じ部品番号がすでに使用されています。' }
      }

      return replacePart(
        state,
        withPartSettings(selectedPart, {
          reference,
          value: action.value.trim(),
        }),
      )
    }

    case 'change-selected-dip-pin-count': {
      const selectedPart = getSelectedPart(state)

      if (selectedPart?.kind !== 'dip') {
        return state
      }

      const resizedPart = withDipPinCount(selectedPart, action.pinCount)
      return replacePartWithinBoard(state, resizedPart, action.board)
    }

    case 'change-selected-capacitor-polarity': {
      const selectedPart = getSelectedPart(state)

      return selectedPart?.kind === 'capacitor'
        ? replacePart(
            state,
            withCapacitorPolarity(selectedPart, action.polarized),
          )
        : state
    }

    case 'change-selected-led-color': {
      const selectedPart = getSelectedPart(state)

      return selectedPart?.kind === 'led'
        ? replacePart(state, withLedColor(selectedPart, action.color))
        : state
    }

    case 'change-selected-pin-header-columns': {
      const selectedPart = getSelectedPart(state)

      if (selectedPart?.kind !== 'pin-header') {
        return state
      }
      if (action.columns === 2 && selectedPart.pinCount % 2 !== 0) {
        return {
          ...state,
          error: '2列ピンヘッダーの端子数は偶数にしてください。',
        }
      }

      return replacePartWithinBoard(
        state,
        withPinHeaderConfiguration(selectedPart, {
          columns: action.columns,
          pinCount: selectedPart.pinCount,
        }),
        action.board,
      )
    }

    case 'change-selected-pin-header-gender': {
      const selectedPart = getSelectedPart(state)

      return selectedPart?.kind === 'pin-header'
        ? replacePart(state, withPinHeaderGender(selectedPart, action.gender))
        : state
    }

    case 'change-selected-pin-header-numbering': {
      const selectedPart = getSelectedPart(state)

      if (
        selectedPart?.kind !== 'pin-header' ||
        selectedPart.numbering === action.numbering
      ) {
        return state
      }

      const numberedPart = withPinHeaderNumbering(
        selectedPart,
        action.numbering,
      )
      const nextState = replacePart(state, numberedPart)

      return {
        ...nextState,
        pinNetAssignments: remapPinHeaderAssignments(
          nextState.pinNetAssignments,
          selectedPart,
          numberedPart,
        ),
      }
    }

    case 'change-selected-pin-count': {
      const selectedPart = getSelectedPart(state)

      if (selectedPart?.kind === 'pin-header') {
        if (selectedPart.columns === 2 && action.pinCount % 2 !== 0) {
          return {
            ...state,
            error: '2列ピンヘッダーの端子数は偶数にしてください。',
          }
        }

        return replacePartWithinBoard(
          state,
          withPinHeaderConfiguration(selectedPart, {
            columns: selectedPart.columns,
            pinCount: action.pinCount,
          }),
          action.board,
        )
      }

      if (selectedPart?.kind === 'connector') {
        return replacePartWithinBoard(
          state,
          withConnectorPinCount(selectedPart, action.pinCount),
          action.board,
        )
      }

      return state
    }

    case 'create-net': {
      const name = normalizeNetName(action.name)
      const color = action.color?.trim()

      if (action.id.trim().length === 0) {
        return { ...state, error: 'ネットIDを入力してください。' }
      }
      if (state.nets.some((net) => net.id === action.id)) {
        return { ...state, error: '同じネットIDがすでに使用されています。' }
      }
      if (name.length === 0) {
        return { ...state, error: 'ネット名を入力してください。' }
      }
      if (
        state.nets.some(
          (net) => getNetNameKey(net.name) === getNetNameKey(name),
        )
      ) {
        return { ...state, error: '同じネット名がすでに使用されています。' }
      }
      if (color !== undefined && !isValidNetColor(color)) {
        return {
          ...state,
          error: 'ネット色は#から始まる6桁の色コードにしてください。',
        }
      }

      return {
        ...state,
        nets: [
          ...state.nets,
          {
            id: action.id,
            name,
            kind: action.kind,
            ...(color === undefined ? {} : { color }),
          },
        ],
        error: null,
      }
    }

    case 'update-net': {
      const target = state.nets.find((net) => net.id === action.netId)
      const name = normalizeNetName(action.name)
      const color = action.color?.trim()

      if (target === undefined) {
        return { ...state, error: '変更するネットが見つかりません。' }
      }
      if (name.length === 0) {
        return { ...state, error: 'ネット名を入力してください。' }
      }
      if (
        state.nets.some(
          (net) =>
            net.id !== action.netId &&
            getNetNameKey(net.name) === getNetNameKey(name),
        )
      ) {
        return { ...state, error: '同じネット名がすでに使用されています。' }
      }
      if (color !== undefined && !isValidNetColor(color)) {
        return {
          ...state,
          error: 'ネット色は#から始まる6桁の色コードにしてください。',
        }
      }

      return {
        ...state,
        nets: state.nets.map((net) =>
          net.id === action.netId
            ? {
                id: net.id,
                name,
                kind: action.kind,
                ...(color === undefined ? {} : { color }),
              }
            : net,
        ),
        error: null,
      }
    }

    case 'delete-net':
      if (!state.nets.some((net) => net.id === action.netId)) {
        return { ...state, error: '削除するネットが見つかりません。' }
      }
      return {
        ...state,
        nets: state.nets.filter((net) => net.id !== action.netId),
        pinNetAssignments: state.pinNetAssignments.filter(
          (assignment) => assignment.netId !== action.netId,
        ),
        error: null,
      }

    case 'assign-pin-net': {
      const part = state.parts.find((item) => item.id === action.partId)
      const existingAssignment = state.pinNetAssignments.find(
        (assignment) =>
          assignment.partId === action.partId &&
          assignment.pinNumber === action.pinNumber,
      )

      if (part === undefined) {
        return { ...state, error: '割り当てる部品が見つかりません。' }
      }
      if (!hasPartPin(part, action.pinNumber)) {
        return { ...state, error: '割り当てる部品端子が見つかりません。' }
      }
      if (part.kind === 'tactile-switch') {
        return {
          ...state,
          error:
            'タクトSWのネットは左側または右側の端子組から割り当ててください。',
        }
      }
      if (!state.nets.some((net) => net.id === action.netId)) {
        return { ...state, error: '割り当てるネットが見つかりません。' }
      }
      if (existingAssignment?.netId === action.netId) {
        return {
          ...state,
          error: 'この部品端子にはすでにネットが割り当てられています。',
        }
      }

      return {
        ...state,
        pinNetAssignments:
          existingAssignment === undefined
            ? [
                ...state.pinNetAssignments,
                {
                  partId: action.partId,
                  pinNumber: action.pinNumber,
                  netId: action.netId,
                },
              ]
            : state.pinNetAssignments.map((assignment) =>
                assignment === existingAssignment
                  ? { ...assignment, netId: action.netId }
                  : assignment,
              ),
        error: null,
      }
    }

    case 'assign-tactile-switch-group-net': {
      const part = state.parts.find((item) => item.id === action.partId)

      if (part?.kind !== 'tactile-switch') {
        return { ...state, error: '割り当てるタクトSWが見つかりません。' }
      }
      if (!state.nets.some((net) => net.id === action.netId)) {
        return { ...state, error: '割り当てるネットが見つかりません。' }
      }

      const pinNumbers = new Set<string>(
        TACTILE_SWITCH_PIN_GROUPS[action.group],
      )
      const unaffectedAssignments = state.pinNetAssignments.filter(
        (assignment) =>
          assignment.partId !== part.id ||
          !pinNumbers.has(assignment.pinNumber),
      )

      return {
        ...state,
        pinNetAssignments: [
          ...unaffectedAssignments,
          ...part.pins
            .filter((pin) => pinNumbers.has(pin.number))
            .map((pin) => ({
              partId: part.id,
              pinNumber: pin.number,
              netId: action.netId,
            })),
        ],
        error: null,
      }
    }

    case 'unassign-pin-net': {
      const part = state.parts.find((item) => item.id === action.partId)

      if (part?.kind === 'tactile-switch') {
        return {
          ...state,
          error:
            'タクトSWのネットは左側または右側の端子組から解除してください。',
        }
      }

      const assignments = state.pinNetAssignments.filter(
        (assignment) =>
          assignment.partId !== action.partId ||
          assignment.pinNumber !== action.pinNumber,
      )

      return assignments.length === state.pinNetAssignments.length
        ? { ...state, error: '解除する端子割り当てが見つかりません。' }
        : { ...state, pinNetAssignments: assignments, error: null }
    }

    case 'unassign-tactile-switch-group-net': {
      const part = state.parts.find((item) => item.id === action.partId)

      if (part?.kind !== 'tactile-switch') {
        return { ...state, error: '解除するタクトSWが見つかりません。' }
      }

      const pinNumbers = new Set<string>(
        TACTILE_SWITCH_PIN_GROUPS[action.group],
      )
      const assignments = state.pinNetAssignments.filter(
        (assignment) =>
          assignment.partId !== part.id ||
          !pinNumbers.has(assignment.pinNumber),
      )

      return assignments.length === state.pinNetAssignments.length
        ? {
            ...state,
            error: '解除するタクトSW端子組のネットが見つかりません。',
          }
        : { ...state, pinNetAssignments: assignments, error: null }
    }

    case 'clear-error':
      return { ...state, error: null }
  }
}
