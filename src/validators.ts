import { AttendanceGoals, MonthlyScore, Patient, ScaleType, Settings, ValidationResult } from './types'
import { SCALE_LABELS } from './seed'

export const MONTH_INDEXES = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const scaleRanges: Record<ScaleType, { min: number; max: number }> = {
  PHQ9: { min: 0, max: 27 },
  GAD7: { min: 0, max: 21 },
  SDS: { min: 0, max: 30 },
}

export const getScaleRange = (scale: ScaleType, settings: Settings) => {
  if (scale === 'SDS') {
    return { min: 0, max: settings.sdsMax }
  }
  return scaleRanges[scale]
}

export const validatePatient = (
  patient: Patient,
  existing: Patient[],
  allowId?: string
): ValidationResult => {
  const errors: string[] = []
  const mrn = patient.mrn.trim()
  if (!mrn) {
    errors.push('MRN is required.')
  }
  if (!patient.patientName.trim()) {
    errors.push('Patient name is required.')
  }
  if (!Number.isInteger(patient.age) || patient.age < 0 || patient.age > 120) {
    errors.push('Age must be an integer between 0 and 120.')
  }
  if (!patient.tier) {
    errors.push('Tier is required.')
  }
  if (!patient.careCoordinator) {
    errors.push('Care coordinator is required.')
  }
  if (!patient.startDate) {
    errors.push('Start date is required.')
  }
  if (!patient.expectedGraduationDate) {
    errors.push('Expected graduation date is required.')
  }
  if (patient.startDate && patient.expectedGraduationDate) {
    if (patient.expectedGraduationDate < patient.startDate) {
      errors.push('Expected graduation date cannot be before start date.')
    }
  }
  const duplicate = existing.find(
    (p) => p.mrn.trim().toLowerCase() === mrn.toLowerCase() && p.patientId !== allowId
  )
  if (duplicate) {
    errors.push('MRN must be unique.')
  }
  return { ok: errors.length === 0, errors }
}

export const validateAttendance = (attendance: AttendanceGoals): ValidationResult => {
  const errors: string[] = []
  const fields: Array<[keyof AttendanceGoals, string]> = [
    ['psychologyIndividualSessions', 'Psychology individual sessions'],
    ['otSessions', 'OT sessions'],
    ['psychiatrySessions', 'Psychiatry sessions'],
    ['workshopSessions', 'Workshop sessions'],
    ['familySessions', 'Family sessions'],
  ]
  fields.forEach(([key, label]) => {
    const value = attendance[key]
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${label} must be a whole number ≥ 0.`)
    }
  })
  return { ok: errors.length === 0, errors }
}

export const validateMonthlyScore = (
  score: MonthlyScore,
  settings: Settings
): ValidationResult => {
  const errors: string[] = []
  if (!MONTH_INDEXES.includes(score.monthIndex)) {
    errors.push('Invalid month index.')
  }
  const range = getScaleRange(score.scaleType, settings)
  if (!score.notCollected) {
    if (score.value === null || Number.isNaN(score.value)) {
      errors.push(`${SCALE_LABELS[score.scaleType]} requires a value or Not collected.`)
    } else if (!Number.isInteger(score.value)) {
      errors.push(`${SCALE_LABELS[score.scaleType]} must be a whole number.`)
    } else if (score.value < range.min || score.value > range.max) {
      errors.push(
        `${SCALE_LABELS[score.scaleType]} must be between ${range.min} and ${range.max}.`
      )
    }
  }
  return { ok: errors.length === 0, errors }
}

export const validateSettings = (settings: Settings): ValidationResult => {
  const errors: string[] = []
  if (!settings.tiers.length) {
    errors.push('At least one tier is required.')
  }
  if (!settings.coordinators.length) {
    errors.push('At least one care coordinator is required.')
  }
  if (!Number.isInteger(settings.sdsMax) || settings.sdsMax < 1 || settings.sdsMax > 60) {
    errors.push('SDS max must be an integer between 1 and 60.')
  }
  return { ok: errors.length === 0, errors }
}
