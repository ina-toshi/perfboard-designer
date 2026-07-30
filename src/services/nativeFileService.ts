import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { AssemblySvgSide } from '../domain/svgExport'

const DESIGN_EXTENSION = '.perfboard.json'
const SVG_EXTENSION = '.svg'
const DESIGN_FILTER = {
  name: 'Perfboard Designer設計ファイル',
  extensions: ['perfboard.json'],
}
const SVG_FILTER = {
  name: 'SVG画像',
  extensions: ['svg'],
}

export function ensureDesignExtension(filePath: string): string {
  return filePath.toLocaleLowerCase().endsWith(DESIGN_EXTENSION)
    ? filePath
    : `${filePath}${DESIGN_EXTENSION}`
}

export function createDefaultFileName(designName: string): string {
  const safeName =
    designName
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\.+$/g, '') || '名称未設定'

  return `${safeName}${DESIGN_EXTENSION}`
}

export function sanitizeExportBaseName(designName: string): string {
  const safeName = Array.from(designName.trim())
    .map((character) =>
      character.charCodeAt(0) <= 31 || '<>:"/\\|?*'.includes(character)
        ? '-'
        : character,
    )
    .join('')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80)
  const reservedWindowsName =
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeName)

  if (safeName.length === 0) {
    return '名称未設定'
  }

  return reservedWindowsName ? `design-${safeName}` : safeName
}

export function ensureSvgExtension(filePath: string): string {
  return filePath.toLocaleLowerCase().endsWith(SVG_EXTENSION)
    ? filePath
    : `${filePath}${SVG_EXTENSION}`
}

export function createSvgExportFileName(
  designName: string,
  side: AssemblySvgSide,
  mirrorBack: boolean,
): string {
  const safeName = sanitizeExportBaseName(designName)
  const suffix =
    side === 'front'
      ? 'front'
      : mirrorBack
        ? 'back-mirrored'
        : 'back-unmirrored'

  return `${safeName}-${suffix}${SVG_EXTENSION}`
}

export async function chooseDesignFileToOpen(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [DESIGN_FILTER],
  })

  return typeof selected === 'string' ? selected : null
}

export async function chooseDesignFileToSave(
  designName: string,
  currentPath: string | null,
): Promise<string | null> {
  const selected = await save({
    defaultPath: currentPath ?? createDefaultFileName(designName),
    filters: [DESIGN_FILTER],
  })

  return selected === null ? null : ensureDesignExtension(selected)
}

export async function chooseSvgFileToSave(
  designName: string,
  side: AssemblySvgSide,
  mirrorBack: boolean,
): Promise<string | null> {
  const selected = await save({
    defaultPath: createSvgExportFileName(designName, side, mirrorBack),
    filters: [SVG_FILTER],
  })

  return selected === null ? null : ensureSvgExtension(selected)
}

export function readDesignFile(filePath: string): Promise<string> {
  return invoke<string>('read_design_file', { filePath })
}

export function writeDesignFile(
  filePath: string,
  contents: string,
): Promise<void> {
  return invoke('write_design_file', { filePath, contents })
}

export function writeSvgFile(
  filePath: string,
  contents: string,
): Promise<void> {
  return invoke('write_svg_file', { filePath, contents })
}

export function readRecoveryFile(): Promise<string | null> {
  return invoke<string | null>('read_recovery_file')
}

export function writeRecoveryFile(contents: string): Promise<void> {
  return invoke('write_recovery_file', { contents })
}

export function deleteRecoveryFile(): Promise<void> {
  return invoke('delete_recovery_file')
}
