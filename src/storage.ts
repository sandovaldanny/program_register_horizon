import { AppState } from './types'
import { seedState } from './seed'

const STORAGE_KEY = 'mhp-tracker-v1'
const SCHEMA_VERSION = 1

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return seedState
    }
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return seedState
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return seedState
    }
    return parsed as AppState
  } catch {
    return seedState
  }
}

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures (quota, privacy mode, etc.)
  }
}

export const exportState = (state: AppState) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'mental-health-tracker-export.json'
  anchor.click()
  URL.revokeObjectURL(url)
}
