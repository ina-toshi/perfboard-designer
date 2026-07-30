import { useState } from 'react'
import type {
  AssemblySvgSide,
  SvgExportDesign,
  SvgExportOptions,
} from '../domain/svgExport'
import { getErrorMessage, getFileName } from '../stores/projectStore'
import { chooseSvgFileToSave, writeSvgFile } from './nativeFileService'
import { exportAssemblySvg, type SvgExportStorage } from './svgExportService'

const SVG_EXPORT_STORAGE: SvgExportStorage = {
  chooseFile: (designName, options) =>
    chooseSvgFileToSave(designName, options.side, options.mirrorBack),
  writeFile: writeSvgFile,
}

export function useSvgExport(
  design: SvgExportDesign,
  mirrorBack: boolean,
  showPartLabels: boolean,
) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportSvg(side: AssemblySvgSide) {
    setBusy(true)
    setMessage(null)
    setError(null)

    const options: SvgExportOptions = { side, mirrorBack, showPartLabels }

    try {
      const filePath = await exportAssemblySvg(
        design,
        options,
        SVG_EXPORT_STORAGE,
      )

      if (filePath !== null) {
        const sideLabel = side === 'front' ? '表面SVG' : '裏面SVG'
        setMessage(`${sideLabel}を出力しました: ${getFileName(filePath)}`)
      }
    } catch (exportError) {
      setError(
        getErrorMessage(exportError, 'SVGファイルを出力できませんでした。'),
      )
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    message,
    error,
    exportFrontSvg: () => exportSvg('front'),
    exportBackSvg: () => exportSvg('back'),
  }
}
