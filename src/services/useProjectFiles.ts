import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react'
import type { PendingUnsavedAction } from '../components/files/FileDialogs'
import {
  createEmptyDesignState,
  getDesignFingerprint,
  serializeDesignDocument,
} from '../domain/designDocument'
import type { RecoveryDraft } from '../domain/recoveryDocument'
import {
  getEditorDesignState,
  type EditorHistoryAction,
  type EditorHistoryState,
} from '../stores/editorHistory'
import {
  createProjectFileState,
  getErrorMessage,
  getFileName,
  getProjectOperationLabel,
  isProjectDirty,
  loadDesignSafely,
  projectFileReducer,
} from '../stores/projectStore'
import {
  chooseDesignFileToOpen,
  chooseDesignFileToSave,
  deleteRecoveryFile,
  readDesignFile,
  readRecoveryFile,
  writeDesignFile,
  writeRecoveryFile,
} from './nativeFileService'
import {
  createRecoveryData,
  detectRecoveryData,
  discardRecoveryData,
  type RecoveryStorage,
} from './recoveryService'

const RECOVERY_SAVE_DELAY_MS = 1500

const RECOVERY_STORAGE: RecoveryStorage = {
  read: readRecoveryFile,
  write: writeRecoveryFile,
  delete: deleteRecoveryFile,
}

export function useProjectFiles(
  history: EditorHistoryState,
  dispatch: Dispatch<EditorHistoryAction>,
) {
  const design = getEditorDesignState(history.present)
  const designFingerprint = getDesignFingerprint(design)
  const [project, projectDispatch] = useReducer(
    projectFileReducer,
    design,
    createProjectFileState,
  )
  const [pendingUnsavedAction, setPendingUnsavedAction] =
    useState<PendingUnsavedAction | null>(null)
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [autoSaveLabel, setAutoSaveLabel] = useState<string | null>(null)
  const recoveryCheckStarted = useRef(false)
  const recoveryTimer = useRef<number | null>(null)
  const bypassCloseWarning = useRef(false)
  const historyRef = useRef(history)
  const designRef = useRef(design)
  const dirtyRef = useRef(false)
  historyRef.current = history
  designRef.current = design

  const dirty = isProjectDirty(project, design)
  const busy = project.operation !== 'idle'
  dirtyRef.current = dirty

  function cancelScheduledRecoverySave() {
    if (recoveryTimer.current !== null) {
      window.clearTimeout(recoveryTimer.current)
      recoveryTimer.current = null
    }
  }

  async function discardRecoveryQuietly() {
    try {
      await discardRecoveryData(RECOVERY_STORAGE)
      setAutoSaveLabel(null)
    } catch (error) {
      setAutoSaveLabel(
        getErrorMessage(
          error,
          '不要になった復旧データを削除できませんでした。',
        ),
      )
    }
  }

  async function saveCurrentDesign(forceChoosePath: boolean): Promise<boolean> {
    cancelScheduledRecoverySave()
    projectDispatch({ type: 'start-operation', operation: 'saving' })

    try {
      const designToSave = designRef.current
      let filePath = forceChoosePath ? null : project.filePath

      if (filePath === null) {
        filePath = await chooseDesignFileToSave(
          designToSave.metadata.name,
          forceChoosePath ? project.filePath : null,
        )
      }
      if (filePath === null) {
        projectDispatch({ type: 'cancel-operation' })
        return false
      }

      await writeDesignFile(filePath, serializeDesignDocument(designToSave))
      projectDispatch({
        type: 'mark-saved',
        filePath,
        fingerprint: getDesignFingerprint(designToSave),
      })
      await discardRecoveryQuietly()
      return true
    } catch (error) {
      projectDispatch({
        type: 'fail-operation',
        error: getErrorMessage(error, '設計ファイルを保存できませんでした。'),
      })
      return false
    }
  }

  async function createNewDesign() {
    cancelScheduledRecoverySave()
    const newDesign = createEmptyDesignState()
    dispatch({ type: 'replace-design', design: newDesign })
    projectDispatch({
      type: 'mark-new',
      fingerprint: getDesignFingerprint(newDesign),
    })
    await discardRecoveryQuietly()
  }

  async function openDesignFile() {
    projectDispatch({ type: 'start-operation', operation: 'opening' })

    try {
      const filePath = await chooseDesignFileToOpen()

      if (filePath === null) {
        projectDispatch({ type: 'cancel-operation' })
        return
      }

      const contents = await readDesignFile(filePath)
      const result = loadDesignSafely(historyRef.current, contents)

      if (!result.ok) {
        projectDispatch({ type: 'fail-operation', error: result.error })
        return
      }

      cancelScheduledRecoverySave()
      dispatch({ type: 'replace-design', design: result.design })
      projectDispatch({
        type: 'mark-opened',
        filePath,
        fingerprint: getDesignFingerprint(result.design),
      })
      await discardRecoveryQuietly()
    } catch (error) {
      projectDispatch({
        type: 'fail-operation',
        error: getErrorMessage(error, '設計ファイルを読み込めませんでした。'),
      })
    }
  }

  async function closeApplication() {
    cancelScheduledRecoverySave()
    await discardRecoveryQuietly()

    if (isTauri()) {
      bypassCloseWarning.current = true
      await getCurrentWindow().close()
    }
  }

  async function continuePendingAction(action: PendingUnsavedAction) {
    switch (action) {
      case 'new':
        await createNewDesign()
        break
      case 'open':
        await openDesignFile()
        break
      case 'close':
        await closeApplication()
        break
    }
  }

  function requestNewDesign() {
    if (dirty) {
      setPendingUnsavedAction('new')
    } else {
      void createNewDesign()
    }
  }

  function requestOpenDesign() {
    if (dirty) {
      setPendingUnsavedAction('open')
    } else {
      void openDesignFile()
    }
  }

  async function saveBeforePendingAction() {
    const action = pendingUnsavedAction

    if (action === null || !(await saveCurrentDesign(false))) {
      return
    }

    setPendingUnsavedAction(null)
    await continuePendingAction(action)
  }

  async function discardBeforePendingAction() {
    const action = pendingUnsavedAction

    if (action === null) {
      return
    }

    setPendingUnsavedAction(null)
    await continuePendingAction(action)
  }

  async function restoreRecoveryDraft() {
    if (recoveryDraft === null) {
      return
    }

    projectDispatch({ type: 'start-operation', operation: 'recovering' })
    dispatch({ type: 'replace-design', design: recoveryDraft.design })
    projectDispatch({ type: 'mark-recovered' })
    setRecoveryDraft(null)
    await discardRecoveryQuietly()
    setRecoveryReady(true)
  }

  async function discardRecoveryDraft() {
    projectDispatch({ type: 'start-operation', operation: 'recovering' })
    await discardRecoveryQuietly()
    setRecoveryDraft(null)
    setRecoveryReady(true)
    projectDispatch({
      type: 'set-message',
      message: '復旧データを破棄して新しい設計で開始しました。',
    })
  }

  useEffect(() => {
    if (recoveryCheckStarted.current) {
      return
    }
    recoveryCheckStarted.current = true

    if (!isTauri()) {
      setRecoveryReady(true)
      return
    }

    projectDispatch({
      type: 'start-operation',
      operation: 'checking-recovery',
    })
    void detectRecoveryData(RECOVERY_STORAGE)
      .then((draft) => {
        if (draft === null) {
          projectDispatch({ type: 'cancel-operation' })
          setRecoveryReady(true)
          return
        }

        setRecoveryDraft(draft)
        projectDispatch({ type: 'cancel-operation' })
      })
      .catch((error: unknown) => {
        projectDispatch({
          type: 'fail-operation',
          error: getErrorMessage(
            error,
            '復旧データを確認できませんでした。通常の新規設計で起動します。',
          ),
        })
        setRecoveryReady(true)
      })
  }, [])

  useEffect(() => {
    cancelScheduledRecoverySave()

    if (!isTauri() || !recoveryReady || recoveryDraft !== null) {
      return
    }
    if (!dirty) {
      setAutoSaveLabel(null)
      void discardRecoveryData(RECOVERY_STORAGE).catch((error: unknown) => {
        setAutoSaveLabel(
          getErrorMessage(
            error,
            '不要になった復旧データを削除できませんでした。',
          ),
        )
      })
      return
    }

    setAutoSaveLabel('未保存の変更を復旧用に保存する準備中です…')
    recoveryTimer.current = window.setTimeout(() => {
      recoveryTimer.current = null
      setAutoSaveLabel('復旧用データを保存中です…')

      void createRecoveryData(RECOVERY_STORAGE, designRef.current)
        .then(() => {
          setAutoSaveLabel('未保存の変更を復旧用に自動保存しました。')
        })
        .catch((error: unknown) => {
          setAutoSaveLabel(
            getErrorMessage(error, '復旧用データを自動保存できませんでした。'),
          )
        })
    }, RECOVERY_SAVE_DELAY_MS)

    return cancelScheduledRecoverySave
  }, [designFingerprint, dirty, recoveryDraft, recoveryReady])

  useEffect(() => {
    if (!isTauri()) {
      return
    }

    let unlisten: (() => void) | undefined
    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (bypassCloseWarning.current) {
          return
        }
        if (dirtyRef.current) {
          event.preventDefault()
          setPendingUnsavedAction('close')
        }
      })
      .then((dispose) => {
        unlisten = dispose
      })

    return () => unlisten?.()
  }, [])

  return {
    project,
    dirty,
    busy,
    fileName: getFileName(project.filePath),
    operationLabel: getProjectOperationLabel(project.operation),
    autoSaveLabel,
    pendingUnsavedAction,
    recoveryDraft,
    requestNewDesign,
    requestOpenDesign,
    saveCurrentDesign,
    saveBeforePendingAction,
    discardBeforePendingAction,
    cancelPendingAction: () => setPendingUnsavedAction(null),
    restoreRecoveryDraft,
    discardRecoveryDraft,
  }
}
