export interface FontAxis {
  tag: string
  name: string
  min: number
  default: number
  max: number
}

export interface FontInstance {
  name: string
  coordinates: Record<string, number>
}

export interface ParsedFont {
  id: string
  path: string
  fileName: string
  familyName: string
  subFamily: string
  postScriptName: string
  weight: number
  isVariable: boolean
  axes: FontAxis[]
  instances: FontInstance[]
  dataUrl: string
  format: string
  fileSize: number
}

export interface FontFamily {
  id: string
  name: string
  fonts: ParsedFont[]
  isVariable: boolean
  installStatus: 'idle' | 'installing' | 'installed' | 'error'
}

export type InstallStatus = FontFamily['installStatus']
