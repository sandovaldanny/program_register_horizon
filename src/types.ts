export type ScaleType = 'PHQ9' | 'GAD7' | 'SDS' | 'WHODAS'

export type Patient = {
  patientId: string
  mrn: string
  patientName: string
  age: number
  tier: string
  startDate: string
  expectedGraduationDate: string
  careCoordinator: string
}

export type MonthlyScore = {
  patientId: string
  scaleType: ScaleType
  monthIndex: number
  value: number | null
  notCollected: boolean
  savedAt?: string
}

export type AttendanceGoals = {
  patientId: string
  psychologyIndividualSessions: number
  otSessions: number
  psychiatrySessions: number
  workshopSessions: number
  familySessions: number
}

export type Settings = {
  tiers: string[]
  coordinators: string[]
  sdsMax: number
}

export type AppState = {
  schemaVersion: number
  patients: Patient[]
  monthlyScores: MonthlyScore[]
  attendance: AttendanceGoals[]
  settings: Settings
}

export type ValidationResult = {
  ok: boolean
  errors: string[]
}
