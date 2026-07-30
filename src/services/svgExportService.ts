import {
  generateAssemblySvg,
  type SvgExportDesign,
  type SvgExportOptions,
} from '../domain/svgExport'

export type SvgExportStorage = {
  chooseFile: (
    designName: string,
    options: SvgExportOptions,
  ) => Promise<string | null>
  writeFile: (filePath: string, contents: string) => Promise<void>
}

export async function exportAssemblySvg(
  design: SvgExportDesign,
  options: SvgExportOptions,
  storage: SvgExportStorage,
): Promise<string | null> {
  const filePath = await storage.chooseFile(design.metadata.name, options)

  if (filePath === null) {
    return null
  }

  const contents = generateAssemblySvg(design, options)
  await storage.writeFile(filePath, contents)
  return filePath
}
