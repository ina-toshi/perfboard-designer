import type { Part } from './parts'

export type NetKind = 'signal' | 'power' | 'ground'

export type Net = {
  id: string
  name: string
  kind: NetKind
  color?: string
}

export type PinNetAssignment = {
  partId: string
  pinNumber: string
  netId: string
}

export function normalizeNetName(name: string): string {
  return name.trim()
}

export function getNetNameKey(name: string): string {
  return normalizeNetName(name).toLocaleLowerCase()
}

export function isNetKind(value: unknown): value is NetKind {
  return value === 'signal' || value === 'power' || value === 'ground'
}

export function isValidNetColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color)
}

export function hasPartPin(part: Part, pinNumber: string): boolean {
  return part.pins.some((pin) => pin.number === pinNumber)
}

export function getPinAssignmentKey(
  assignment: Pick<PinNetAssignment, 'partId' | 'pinNumber'>,
): string {
  return JSON.stringify([assignment.partId, assignment.pinNumber])
}

export function prunePinNetAssignments(
  assignments: PinNetAssignment[],
  parts: Part[],
): PinNetAssignment[] {
  const partsById = new Map(parts.map((part) => [part.id, part]))

  return assignments.filter((assignment) => {
    const part = partsById.get(assignment.partId)
    return part !== undefined && hasPartPin(part, assignment.pinNumber)
  })
}
