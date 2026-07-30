export type HighlightState = {
  selectedNetId: string | null
  selectedIssueKey: string | null
}

export type HighlightAction =
  | { type: 'toggle-net'; netId: string }
  | { type: 'toggle-issue'; issueKey: string }
  | { type: 'clear' }

export const INITIAL_HIGHLIGHT_STATE: HighlightState = {
  selectedNetId: null,
  selectedIssueKey: null,
}

export function highlightReducer(
  state: HighlightState,
  action: HighlightAction,
): HighlightState {
  switch (action.type) {
    case 'toggle-net':
      return {
        selectedNetId:
          state.selectedNetId === action.netId ? null : action.netId,
        selectedIssueKey: null,
      }
    case 'toggle-issue':
      return {
        selectedNetId: null,
        selectedIssueKey:
          state.selectedIssueKey === action.issueKey ? null : action.issueKey,
      }
    case 'clear':
      return INITIAL_HIGHLIGHT_STATE
  }
}
