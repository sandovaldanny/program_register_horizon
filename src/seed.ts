import { AppState, ScaleType } from './types'

const today = new Date()
const iso = (d: Date) => d.toISOString().slice(0, 10)

const mkDate = (offsetDays: number) => {
  const copy = new Date(today)
  copy.setDate(copy.getDate() + offsetDays)
  return iso(copy)
}

const seedStamp = new Date().toISOString()

export const seedState: AppState = {
  schemaVersion: 1,
  settings: {
    tiers: ['Tier 1', 'Tier 2', 'Tier 3'],
    coordinators: ['A. Rivera', 'J. Patel', 'M. Chen'],
    sdsMax: 30,
  },
  patients: [
    {
      patientId: 'p-001',
      mrn: 'MRN-1023',
      patientName: 'Lucia Gomez',
      age: 29,
      tier: 'Tier 1',
      startDate: mkDate(-90),
      expectedGraduationDate: mkDate(90),
      careCoordinator: 'A. Rivera',
    },
    {
      patientId: 'p-002',
      mrn: 'MRN-2049',
      patientName: 'Marco Ruiz',
      age: 41,
      tier: 'Tier 2',
      startDate: mkDate(-120),
      expectedGraduationDate: mkDate(60),
      careCoordinator: 'J. Patel',
    },
    {
      patientId: 'p-003',
      mrn: 'MRN-3091',
      patientName: 'Sofia Torres',
      age: 36,
      tier: 'Tier 3',
      startDate: mkDate(-60),
      expectedGraduationDate: mkDate(120),
      careCoordinator: 'M. Chen',
    },
  ],
  monthlyScores: [
    { patientId: 'p-001', scaleType: 'PHQ9', monthIndex: 0, value: 18, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-001', scaleType: 'PHQ9', monthIndex: 2, value: 14, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-001', scaleType: 'PHQ9', monthIndex: 4, value: 9, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-001', scaleType: 'GAD7', monthIndex: 0, value: 16, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-001', scaleType: 'GAD7', monthIndex: 2, value: 11, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-001', scaleType: 'SDS', monthIndex: 0, value: 20, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-001', scaleType: 'SDS', monthIndex: 6, value: 12, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-002', scaleType: 'PHQ9', monthIndex: 0, value: 22, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-002', scaleType: 'PHQ9', monthIndex: 2, value: 20, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-002', scaleType: 'GAD7', monthIndex: 0, value: 14, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-002', scaleType: 'GAD7', monthIndex: 5, value: 10, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-002', scaleType: 'SDS', monthIndex: 0, value: 24, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-003', scaleType: 'PHQ9', monthIndex: 0, value: 12, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-003', scaleType: 'PHQ9', monthIndex: 3, value: 10, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-003', scaleType: 'GAD7', monthIndex: 0, value: 9, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-003', scaleType: 'SDS', monthIndex: 0, value: 17, notCollected: false, savedAt: seedStamp },
    { patientId: 'p-003', scaleType: 'SDS', monthIndex: 8, value: 15, notCollected: false, savedAt: seedStamp },
  ],
  attendance: [
    {
      patientId: 'p-001',
      psychologyIndividualSessions: 6,
      otSessions: 2,
      psychiatrySessions: 1,
      workshopSessions: 4,
      familySessions: 1,
    },
    {
      patientId: 'p-002',
      psychologyIndividualSessions: 4,
      otSessions: 3,
      psychiatrySessions: 2,
      workshopSessions: 2,
      familySessions: 0,
    },
    {
      patientId: 'p-003',
      psychologyIndividualSessions: 5,
      otSessions: 1,
      psychiatrySessions: 1,
      workshopSessions: 3,
      familySessions: 2,
    },
  ],
}

export const SCALE_LABELS: Record<ScaleType, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
  SDS: 'SDS',
}
