export type DesignMetadata = {
  name: string
}

export const DEFAULT_DESIGN_NAME = '名称未設定'

export function createDefaultDesignMetadata(): DesignMetadata {
  return { name: DEFAULT_DESIGN_NAME }
}
