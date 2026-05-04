import React, { useEffect, useMemo, useReducer, useState } from 'react'
import { seedState, SCALE_LABELS } from '../seed'
import { exportState, loadState, saveState } from '../storage'
import {
  AppState,
  AttendanceGoals,
  MonthlyScore,
  Patient,
  ScaleType,
  Settings,
} from '../types'
import {
  getScaleRange,
  MONTH_INDEXES,
  validateAttendance,
  validateMonthlyScore,
  validatePatient,
  validateSettings,
} from '../validators'

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const monthLabel = (index: number) => (index === 0 ? 'Initial' : `M${index}`)

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(22,69,92,0.14)',
  background: 'rgba(247,251,252,0.85)',
  color: 'var(--indigo)',
  fontWeight: 600,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'rgba(22,69,92,0.75)',
  letterSpacing: '0.3px',
}

const cardBodyStyle: React.CSSProperties = {
  padding: 16,
  display: 'grid',
  gap: 12,
}

const gridCols = (min = 220) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  gap: 12,
})

type Action =
  | { type: 'ADD_PATIENT'; patient: Patient }
  | { type: 'UPDATE_PATIENT'; patient: Patient }
  | { type: 'UPSERT_SCORE'; score: MonthlyScore }
  | { type: 'SET_ATTENDANCE'; attendance: AttendanceGoals }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'IMPORT_STATE'; state: AppState }

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_PATIENT': {
      const hasAttendance = state.attendance.some(
        (entry) => entry.patientId === action.patient.patientId
      )
      const nextAttendance = hasAttendance
        ? state.attendance
        : [
            ...state.attendance,
            {
              patientId: action.patient.patientId,
              psychologyIndividualSessions: 0,
              otSessions: 0,
              psychiatrySessions: 0,
              workshopSessions: 0,
              familySessions: 0,
            },
          ]
      return {
        ...state,
        patients: [...state.patients, action.patient],
        attendance: nextAttendance,
      }
    }
    case 'UPDATE_PATIENT': {
      return {
        ...state,
        patients: state.patients.map((patient) =>
          patient.patientId === action.patient.patientId ? action.patient : patient
        ),
      }
    }
    case 'UPSERT_SCORE': {
      const existing = state.monthlyScores.find(
        (score) =>
          score.patientId === action.score.patientId &&
          score.scaleType === action.score.scaleType &&
          score.monthIndex === action.score.monthIndex
      )
      if (existing) {
        return {
          ...state,
          monthlyScores: state.monthlyScores.map((score) =>
            score === existing ? action.score : score
          ),
        }
      }
      return { ...state, monthlyScores: [...state.monthlyScores, action.score] }
    }
    case 'SET_ATTENDANCE': {
      const existing = state.attendance.find(
        (entry) => entry.patientId === action.attendance.patientId
      )
      if (existing) {
        return {
          ...state,
          attendance: state.attendance.map((entry) =>
            entry.patientId === action.attendance.patientId ? action.attendance : entry
          ),
        }
      }
      return { ...state, attendance: [...state.attendance, action.attendance] }
    }
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }
    case 'IMPORT_STATE':
      return action.state
    default:
      return state
  }
}

const emptyPatient = (settings: Settings): Patient => ({
  patientId: createId(),
  mrn: '',
  patientName: '',
  age: 0,
  tier: settings.tiers[0] ?? '',
  startDate: '',
  expectedGraduationDate: '',
  careCoordinator: settings.coordinators[0] ?? '',
})

const emptyAttendance = (patientId: string): AttendanceGoals => ({
  patientId,
  psychologyIndividualSessions: 0,
  otSessions: 0,
  psychiatrySessions: 0,
  workshopSessions: 0,
  familySessions: 0,
})

const parseInteger = (value: string) => {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return NaN
  return parsed
}

const formatDate = (value: string) => {
  if (!value) return '—'
  return value
}

const formatSavedAt = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const getScoresFor = (state: AppState, patientId: string, scaleType: ScaleType) =>
  state.monthlyScores.filter(
    (score) => score.patientId === patientId && score.scaleType === scaleType
  )

const getAttendanceFor = (state: AppState, patientId: string): AttendanceGoals =>
  state.attendance.find((entry) => entry.patientId === patientId) ?? emptyAttendance(patientId)

const buildScoreMap = (scores: MonthlyScore[]) => {
  const map = new Map<number, MonthlyScore>()
  scores.forEach((score) => map.set(score.monthIndex, score))
  return map
}

const uniqueList = (values: string[]) =>
  values.map((value) => value.trim()).filter((value, index, arr) => value && arr.indexOf(value) === index)

const WHODAS_OPTIONS = ['none', 'mild', 'moderate', 'severe', 'extreme or cannot do'] as const

const WHODAS_QUESTIONS = [
  'S1 Standing for long periods such as 30 minutes?',
  'S2 Taking care of your household responsibilities?',
  'S3 Learning a new task, for example, learning how to get to a new place?',
  'S4 How much of a problem did you have joining in community activities (for example, festivities, religious or other activities) in the same way as anyone else can?',
  'S5 How much have you been emotionally affected by your health problems?',
  'S6 Concentrating on doing something for ten minutes?',
  'S7 Walking a long distance such as a kilometre [or equivalent]?',
  'S8 Washing your whole body?',
  'S9 Getting dressed?',
  'S10 Dealing with people you do not know?',
  'S11 Maintaining a friendship?',
  'S12 Your day-to-day work?',
] as const

type ViewKey = 'patients' | 'detail' | 'settings' | 'import'

export default function ProgramRegister() {
  const [state, dispatch] = useReducer(reducer, seedState, () => loadState())
  const [view, setView] = useState<ViewKey>('patients')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    state.patients[0]?.patientId ?? null
  )
  const [patientFormOpen, setPatientFormOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (!selectedPatientId && state.patients[0]) {
      setSelectedPatientId(state.patients[0].patientId)
    }
  }, [selectedPatientId, state.patients])

  const selectedPatient = useMemo(
    () => state.patients.find((patient) => patient.patientId === selectedPatientId) ?? null,
    [selectedPatientId, state.patients]
  )

  const openNewPatientForm = () => {
    setEditingPatient(null)
    setPatientFormOpen(true)
  }

  const openEditPatientForm = (patient: Patient) => {
    setEditingPatient(patient)
    setPatientFormOpen(true)
  }

  const handleSavePatient = (patient: Patient) => {
    const normalized = { ...patient, mrn: patient.mrn.trim(), patientName: patient.patientName.trim() }
    if (editingPatient) {
      dispatch({ type: 'UPDATE_PATIENT', patient: normalized })
      setStatusMessage('Patient updated successfully.')
    } else {
      dispatch({ type: 'ADD_PATIENT', patient: normalized })
      setSelectedPatientId(normalized.patientId)
      setStatusMessage('Patient added successfully.')
    }
    setPatientFormOpen(false)
  }

  const handleImport = (imported: AppState) => {
    dispatch({ type: 'IMPORT_STATE', state: imported })
    setSelectedPatientId(imported.patients[0]?.patientId ?? null)
    setStatusMessage('Import completed successfully.')
  }

  return (
    <div className="container">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">MH</div>
          <div>
            <div className="brandTitle">Mental Health Program</div>
          </div>
        </div>
        <div className="ctaRow">
          <button className="btnGhost" onClick={() => setView('patients')}>
            Patients
          </button>
          <button className="btnGhost" onClick={() => setView('detail')}>
            Patient Detail
          </button>
          <button className="btnGhost" onClick={() => setView('settings')}>
            Settings
          </button>
          <button className="btnGhost" onClick={() => setView('import')}>
            Import/Export
          </button>
          <div className="headerLogo">
            <img
              className="logoImg"
              src="/ALKALMA_Logo_EN.png"
              alt="ALKALMA"
            />
          </div>
        </div>
      </header>

      {statusMessage ? (
        <div className="hero" style={{ marginTop: 12 }}>
          <div className="p">{statusMessage}</div>
        </div>
      ) : null}

      {view === 'patients' && (
        <PatientsView
          state={state}
          onOpenNew={openNewPatientForm}
          onSelectPatient={(id) => {
            setSelectedPatientId(id)
            setView('detail')
          }}
          onEditPatient={openEditPatientForm}
        />
      )}

      {view === 'detail' && (
        <PatientDetailView
          state={state}
          patient={selectedPatient}
          onSelectPatient={setSelectedPatientId}
          onEditPatient={openEditPatientForm}
          onSaveAttendance={(attendance) => dispatch({ type: 'SET_ATTENDANCE', attendance })}
          onSaveScore={(score) => dispatch({ type: 'UPSERT_SCORE', score })}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          settings={state.settings}
          onSave={(settings) => {
            dispatch({ type: 'SET_SETTINGS', settings })
            setStatusMessage('Settings saved successfully.')
          }}
        />
      )}

      {view === 'import' && (
        <ImportExportView
          state={state}
          onImport={handleImport}
          onExport={() => exportState(state)}
        />
      )}

      {patientFormOpen && (
        <PatientForm
          settings={state.settings}
          existingPatients={state.patients}
          patient={editingPatient}
          onClose={() => setPatientFormOpen(false)}
          onSave={handleSavePatient}
        />
      )}
    </div>
  )
}

const PatientsView = ({
  state,
  onOpenNew,
  onSelectPatient,
  onEditPatient,
}: {
  state: AppState
  onOpenNew: () => void
  onSelectPatient: (id: string) => void
  onEditPatient: (patient: Patient) => void
}) => {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [coordinatorFilter, setCoordinatorFilter] = useState('')

  const filtered = state.patients.filter((patient) => {
    const matchesSearch =
      patient.mrn.toLowerCase().includes(search.toLowerCase()) ||
      patient.patientName.toLowerCase().includes(search.toLowerCase()) ||
      patient.careCoordinator.toLowerCase().includes(search.toLowerCase())
    const matchesTier = tierFilter ? patient.tier === tierFilter : true
    const matchesCoordinator = coordinatorFilter ? patient.careCoordinator === coordinatorFilter : true
    return matchesSearch && matchesTier && matchesCoordinator
  })

  return (
    <section className="hero">
      <div className="heroGrid">
        <div>
          <div className="h1">Patients</div>
          <p className="p">
            Search by MRN, patient name, or coordinator. Filters enforce the configured tier and coordinator lists.
          </p>
          <div className="kpiRow">
            <div className="kpi">Total: {state.patients.length}</div>
            <div className="kpi">Active tiers: {state.settings.tiers.length}</div>
            <div className="kpi">Coordinators: {state.settings.coordinators.length}</div>
          </div>
        </div>
        <div className="rightCard">
          <div className="miniTitle">Quick Actions</div>
          <ul className="miniList">
            <li>Use “Add Patient” to capture intake details.</li>
            <li>MRN must be unique and required.</li>
            <li>Dates enforce start ≤ expected graduation.</li>
          </ul>
          <div className="ctaRow" style={{ marginTop: 12 }}>
            <button className="btnPrimary" onClick={onOpenNew}>
              Add Patient
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...gridCols(200), marginTop: 16 }}>
        <div>
          <label style={labelStyle}>Search</label>
          <input
            className="searchInput"
            placeholder="Search MRN, patient, coordinator"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Tier</label>
          <select
            value={tierFilter}
            onChange={(event) => setTierFilter(event.target.value)}
            style={baseInputStyle}
          >
            <option value="">All tiers</option>
            {state.settings.tiers.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Coordinator</label>
          <select
            value={coordinatorFilter}
            onChange={(event) => setCoordinatorFilter(event.target.value)}
            style={baseInputStyle}
          >
            <option value="">All coordinators</option>
            {state.settings.coordinators.map((coordinator) => (
              <option key={coordinator} value={coordinator}>
                {coordinator}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sheetCard" style={{ marginTop: 16 }}>
        <div className="sheetHeader">
          <div>
            <div className="sheetTitle">Patient Registry</div>
            <div className="sheetSubtitle">Click view to inspect monthly scores and attendance.</div>
          </div>
          <button className="btnPrimary" onClick={onOpenNew}>
            Add Patient
          </button>
        </div>
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>MRN</th>
                <th>Name</th>
                <th>Age</th>
                <th>Tier</th>
                <th>Start</th>
                <th>Expected Graduation</th>
                <th>Coordinator</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="emptyState">
                    No patients match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((patient) => (
                  <tr key={patient.patientId}>
                    <td className="cellMono">{patient.mrn}</td>
                    <td className="cellStrong">{patient.patientName}</td>
                    <td>{patient.age}</td>
                    <td>
                      <span className="pillTag">{patient.tier}</span>
                    </td>
                    <td>{formatDate(patient.startDate)}</td>
                    <td>{formatDate(patient.expectedGraduationDate)}</td>
                    <td>{patient.careCoordinator}</td>
                    <td>
                      <div className="ctaRow">
                        <button className="btnGhost" onClick={() => onSelectPatient(patient.patientId)}>
                          View
                        </button>
                        <button className="btnGhost" onClick={() => onEditPatient(patient)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

const PatientDetailView = ({
  state,
  patient,
  onSelectPatient,
  onEditPatient,
  onSaveAttendance,
  onSaveScore,
}: {
  state: AppState
  patient: Patient | null
  onSelectPatient: (id: string) => void
  onEditPatient: (patient: Patient) => void
  onSaveAttendance: (attendance: AttendanceGoals) => void
  onSaveScore: (score: MonthlyScore) => void
}) => {
  const [activeScale, setActiveScale] = useState<ScaleType>('PHQ9')

  useEffect(() => {
    if (patient) {
      setActiveScale('PHQ9')
    }
  }, [patient?.patientId])

  if (!patient) {
    return (
      <section className="hero">
        <div className="h1">Patient Detail</div>
        <p className="p">Select a patient from the registry to view details.</p>
      </section>
    )
  }

  const attendance = getAttendanceFor(state, patient.patientId)

  return (
    <section className="hero">
      <div className="heroGrid">
        <div>
          <div className="h1">Patient Detail</div>
          <p className="p">Track monthly scales, attendance, and program milestones.</p>
          <div className="kpiRow">
            <div className="kpi">MRN: {patient.mrn}</div>
            <div className="kpi">Tier: {patient.tier}</div>
            <div className="kpi">Coordinator: {patient.careCoordinator}</div>
          </div>
        </div>
        <div className="rightCard">
          <div className="miniTitle">Quick Actions</div>
          <ul className="miniList">
            <li>Keep scores within validated ranges.</li>
            <li>Mark “Not collected” instead of leaving blanks.</li>
            <li>Attendance fields require whole numbers.</li>
          </ul>
          <div className="ctaRow" style={{ marginTop: 12 }}>
            <button className="btnGhost" onClick={() => onEditPatient(patient)}>
              Edit Patient
            </button>
          </div>
        </div>
      </div>

      <div className="sheetCard" style={{ marginTop: 16 }}>
        <div className="sheetHeader">
          <div>
            <div className="sheetTitle">Patient Information</div>
            <div className="sheetSubtitle">Review demographics and program dates.</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <label style={labelStyle}>Switch patient</label>
            <select
              value={patient.patientId}
              onChange={(event) => onSelectPatient(event.target.value)}
              style={baseInputStyle}
            >
              {state.patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.patientName} • {p.mrn}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={cardBodyStyle}>
          <div style={gridCols(200)}>
            <InfoItem label="MRN" value={patient.mrn} />
            <InfoItem label="Name" value={patient.patientName} />
            <InfoItem label="Age" value={String(patient.age)} />
            <InfoItem label="Tier" value={patient.tier} />
            <InfoItem label="Start Date" value={formatDate(patient.startDate)} />
            <InfoItem label="Expected Graduation" value={formatDate(patient.expectedGraduationDate)} />
            <InfoItem label="Coordinator" value={patient.careCoordinator} />
          </div>
        </div>
      </div>

      <div className="sheetCard" style={{ marginTop: 16 }}>
        <div className="sheetHeader">
          <div>
            <div className="sheetTitle">Scales</div>
            <div className="sheetSubtitle">PHQ-9, GAD-7, whodas 2.0 — Initial and monthly follow-up.</div>
          </div>
          <div className="ctaRow">
            {(['PHQ9', 'GAD7', 'WHODAS'] as ScaleType[]).map((scale) => (
              <button
                key={scale}
                className="btnGhost"
                onClick={() => setActiveScale(scale)}
                style={
                  activeScale === scale
                    ? { background: 'rgba(112,200,195,0.25)', borderColor: 'rgba(0,116,147,0.35)' }
                    : undefined
                }
              >
                {SCALE_LABELS[scale]}
              </button>
            ))}
          </div>
        </div>
        {activeScale === 'WHODAS' ? (
          <WhodasForm patientId={patient.patientId} />
        ) : (
          <ScaleGrid
            patientId={patient.patientId}
            scaleType={activeScale}
            settings={state.settings}
            scores={getScoresFor(state, patient.patientId, activeScale)}
            onSaveScore={onSaveScore}
          />
        )}
      </div>

      <div className="sheetCard" style={{ marginTop: 16 }}>
        <div className="sheetHeader">
          <div>
            <div className="sheetTitle">Attendance & Goals</div>
            <div className="sheetSubtitle">Track accumulated service usage.</div>
          </div>
        </div>
        <AttendanceForm
          attendance={attendance}
          onSave={onSaveAttendance}
        />
      </div>
    </section>
  )
}

const WhodasForm = ({ patientId }: { patientId: string }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string>('')

  useEffect(() => {
    setAnswers({})
    setSavedAt('')
  }, [patientId])

  return (
    <div style={cardBodyStyle}>
      <div className="note">WHODAS 2.0</div>
      <div className="note">WORLD HEALTH ORGANIZATION DISABILITY ASSESSMENT SCHEDULE 2.0</div>
      <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
        {WHODAS_QUESTIONS.map((question) => (
          <div
            key={question}
            style={{
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(22,69,92,0.12)',
              background: 'rgba(247,251,252,0.82)',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--indigo)', marginBottom: 10 }}>{question}</div>
            <div style={{ ...gridCols(140), gap: 10 }}>
              {WHODAS_OPTIONS.map((option) => (
                <label
                  key={`${question}-${option}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(22,69,92,0.12)',
                    background:
                      answers[question] === option ? 'rgba(112,200,195,0.2)' : 'rgba(255,255,255,0.92)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name={question}
                    checked={answers[question] === option}
                    onChange={() => setAnswers((prev) => ({ ...prev, [question]: option }))}
                  />
                  <span style={{ textTransform: 'lowercase' }}>{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ctaRow">
        <button className="btnPrimary" onClick={() => setSavedAt(new Date().toISOString())}>
          Save whodas 2.0
        </button>
        {savedAt ? <span className="note">Saved at {formatSavedAt(savedAt)}</span> : null}
      </div>
    </div>
  )
}

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div style={{ padding: 12, borderRadius: 14, background: 'rgba(112,200,195,0.08)' }}>
    <div style={labelStyle}>{label}</div>
    <div style={{ fontWeight: 800 }}>{value || '—'}</div>
  </div>
)

const AttendanceForm = ({
  attendance,
  onSave,
}: {
  attendance: AttendanceGoals
  onSave: (attendance: AttendanceGoals) => void
}) => {
  const [draft, setDraft] = useState(attendance)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setDraft(attendance)
    setErrors([])
  }, [attendance])

  const handleChange = (key: keyof AttendanceGoals, value: string) => {
    const parsed = parseInteger(value)
    setDraft((prev) => ({ ...prev, [key]: parsed === null ? 0 : parsed }))
  }

  const handleSave = () => {
    const validation = validateAttendance(draft)
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }
    setErrors([])
    onSave(draft)
  }

  return (
    <div style={cardBodyStyle}>
      <div style={gridCols(220)}>
        <NumberField
          label="Psychology Individual"
          value={draft.psychologyIndividualSessions}
          onChange={(value) => handleChange('psychologyIndividualSessions', value)}
          min={0}
        />
        <NumberField
          label="OT Sessions"
          value={draft.otSessions}
          onChange={(value) => handleChange('otSessions', value)}
          min={0}
        />
        <NumberField
          label="Psychiatry Sessions"
          value={draft.psychiatrySessions}
          onChange={(value) => handleChange('psychiatrySessions', value)}
          min={0}
        />
        <NumberField
          label="Workshop Sessions"
          value={draft.workshopSessions}
          onChange={(value) => handleChange('workshopSessions', value)}
          min={0}
        />
        <NumberField
          label="Family Sessions"
          value={draft.familySessions}
          onChange={(value) => handleChange('familySessions', value)}
          min={0}
        />
      </div>
      {errors.length > 0 && (
        <div className="note" style={{ color: 'var(--pink)' }}>
          {errors.join(' ')}
        </div>
      )}
      <div className="ctaRow">
        <button className="btnPrimary" onClick={handleSave}>
          Save Attendance
        </button>
      </div>
    </div>
  )
}

type DraftCell = {
  value: string
  notCollected: boolean
  touched: boolean
  savedAt?: string
}

const ScaleGrid = ({
  patientId,
  scaleType,
  settings,
  scores,
  onSaveScore,
}: {
  patientId: string
  scaleType: ScaleType
  settings: Settings
  scores: MonthlyScore[]
  onSaveScore: (score: MonthlyScore) => void
}) => {
  const [draft, setDraft] = useState<Record<number, DraftCell>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    const map = buildScoreMap(scores)
    const next: Record<number, DraftCell> = {}
    MONTH_INDEXES.forEach((month) => {
      const score = map.get(month)
      next[month] = {
        value: score && score.value !== null ? String(score.value) : '',
        notCollected: score?.notCollected ?? false,
        touched: false,
        savedAt: score?.savedAt,
      }
    })
    setDraft(next)
    setErrors({})
  }, [patientId, scaleType, scores])

  const range = getScaleRange(scaleType, settings)

  const setCell = (month: number, patch: Partial<DraftCell>) => {
    setDraft((prev) => ({
      ...prev,
      [month]: { ...prev[month], ...patch, touched: true },
    }))
  }

  const validate = () => {
    const nextErrors: Record<number, string> = {}
    MONTH_INDEXES.forEach((month) => {
      const cell = draft[month]
      if (!cell) return
      if (!cell.touched && cell.value === '' && !cell.notCollected) {
        return
      }
      const value = parseInteger(cell.value)
      const score: MonthlyScore = {
        patientId,
        scaleType,
        monthIndex: month,
        value: value === null ? null : value,
        notCollected: cell.notCollected,
      }
      const validation = validateMonthlyScore(score, settings)
      if (!validation.ok) {
        nextErrors[month] = validation.errors.join(' ')
      }
    })
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = () => {
    if (!validate()) {
      return
    }
    MONTH_INDEXES.forEach((month) => {
      const cell = draft[month]
      if (!cell) return
      if (cell.value === '' && !cell.notCollected) return
      const parsed = parseInteger(cell.value)
      const score: MonthlyScore = {
        patientId,
        scaleType,
        monthIndex: month,
        value: parsed === null ? null : parsed,
        notCollected: cell.notCollected,
        savedAt: new Date().toISOString(),
      }
      onSaveScore(score)
    })
  }

  const initialValue = (() => {
    const cell = draft[0]
    if (!cell || cell.notCollected) return null
    const parsed = parseInteger(cell.value)
    return parsed === null || Number.isNaN(parsed) ? null : parsed
  })()

  const latestValue = (() => {
    const ordered = [...MONTH_INDEXES].reverse()
    for (const month of ordered) {
      const cell = draft[month]
      if (!cell || cell.notCollected) continue
      const parsed = parseInteger(cell.value)
      if (parsed === null || Number.isNaN(parsed)) continue
      return parsed
    }
    return null
  })()

  const delta = initialValue !== null && latestValue !== null ? latestValue - initialValue : null
  const trendLabel = (() => {
    if (delta === null) return 'Need at least Initial + latest value.'
    if (delta < 0) return 'Improving vs Initial'
    if (delta > 0) return 'Worsening vs Initial'
    return 'Stable vs Initial'
  })()

  const trendColor =
    delta === null
      ? 'rgba(22,69,92,0.7)'
      : delta < 0
        ? 'var(--mint)'
        : delta > 0
          ? 'var(--pink)'
          : 'var(--amber)'

  return (
    <div style={cardBodyStyle}>
      <div style={gridCols(220)}>
        <div>
          <div style={labelStyle}>Range</div>
          <div style={{ fontWeight: 800 }}>
            {range.min} - {range.max}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Initial</div>
          <div style={{ fontWeight: 800 }}>{initialValue ?? '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Latest</div>
          <div style={{ fontWeight: 800 }}>{latestValue ?? '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Delta</div>
          <div style={{ fontWeight: 800 }}>{delta ?? '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Trend</div>
          <div style={{ fontWeight: 800, color: trendColor }}>{trendLabel}</div>
        </div>
      </div>

      <div className="tableWrap" style={{ marginTop: 8 }}>
        <table className="dataTable">
          <thead>
            <tr>
              <th>Month</th>
              <th>Value</th>
              <th>Not collected</th>
              <th>Saved at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MONTH_INDEXES.map((month) => {
              const cell = draft[month]
              const error = errors[month]
              return (
                <tr key={month}>
                  <td className="cellStrong">{monthLabel(month)}</td>
                  <td>
                    <input
                      type="number"
                      min={range.min}
                      max={range.max}
                      step={1}
                      inputMode="numeric"
                      value={cell?.value ?? ''}
                      onChange={(event) =>
                        setCell(month, {
                          value: event.target.value,
                          notCollected: event.target.value ? false : cell?.notCollected ?? false,
                        })
                      }
                      style={{
                        ...baseInputStyle,
                        width: 120,
                        borderColor: error ? 'var(--pink)' : baseInputStyle.border,
                      }}
                    />
                  </td>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={cell?.notCollected ?? false}
                        onChange={(event) =>
                          setCell(month, {
                            notCollected: event.target.checked,
                            value: event.target.checked ? '' : cell?.value ?? '',
                          })
                        }
                      />
                      <span className="note">Not collected</span>
                    </label>
                  </td>
                  <td>
                    <span className="note">{formatSavedAt(cell?.savedAt)}</span>
                  </td>
                  <td>
                    {error ? (
                      <span className="note" style={{ color: 'var(--pink)' }}>
                        {error}
                      </span>
                    ) : cell?.value || cell?.notCollected ? (
                      <span className="note">Ready</span>
                    ) : (
                      <span className="note">Pending entry</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="ctaRow">
        <button className="btnPrimary" onClick={handleSave}>
          Save {SCALE_LABELS[scaleType]}
        </button>
      </div>
    </div>
  )
}

const PatientForm = ({
  patient,
  settings,
  existingPatients,
  onClose,
  onSave,
}: {
  patient: Patient | null
  settings: Settings
  existingPatients: Patient[]
  onClose: () => void
  onSave: (patient: Patient) => void
}) => {
  const [draft, setDraft] = useState(patient ?? emptyPatient(settings))
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setDraft(patient ?? emptyPatient(settings))
    setErrors([])
  }, [patient, settings])

  const updateField = (key: keyof Patient, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const updateNumber = (key: keyof Patient, value: string) => {
    const parsed = parseInteger(value)
    setDraft((prev) => ({ ...prev, [key]: parsed === null ? 0 : parsed }))
  }

  const handleSave = () => {
    const validation = validatePatient(draft, existingPatients, patient?.patientId)
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }
    setErrors([])
    onSave(draft)
  }

  return (
    <div className="modalOverlay">
      <div className="modalCard">
        <div className="modalTop">
          <div>
            <div className="modalTitle">{patient ? 'Edit Patient' : 'Add Patient'}</div>
            <div className="modalSubtitle">Required fields enforce validation to reduce human error.</div>
          </div>
          <button className="btnGhost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modalBody">
          <div style={gridCols(220)}>
            <TextField
              label="MRN"
              value={draft.mrn}
              onChange={(value) => updateField('mrn', value)}
              placeholder="Unique MRN"
            />
            <TextField
              label="Patient Name"
              value={draft.patientName}
              onChange={(value) => updateField('patientName', value)}
              placeholder="Full name"
            />
            <NumberField
              label="Age"
              value={draft.age}
              onChange={(value) => updateNumber('age', value)}
              min={0}
              max={120}
            />
            <SelectField
              label="Tier"
              value={draft.tier}
              options={settings.tiers}
              onChange={(value) => updateField('tier', value)}
            />
            <DateField
              label="Start Date"
              value={draft.startDate}
              onChange={(value) => updateField('startDate', value)}
            />
            <DateField
              label="Expected Graduation Date"
              value={draft.expectedGraduationDate}
              onChange={(value) => updateField('expectedGraduationDate', value)}
            />
            <SelectField
              label="Care Coordinator"
              value={draft.careCoordinator}
              options={settings.coordinators}
              onChange={(value) => updateField('careCoordinator', value)}
            />
          </div>
          {errors.length > 0 && (
            <div className="note" style={{ color: 'var(--pink)', marginTop: 10 }}>
              {errors.join(' ')}
            </div>
          )}
          <div className="ctaRow" style={{ marginTop: 16 }}>
            <button className="btnPrimary" onClick={handleSave}>
              Save Patient
            </button>
            <button className="btnGhost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const SettingsView = ({
  settings,
  onSave,
}: {
  settings: Settings
  onSave: (settings: Settings) => void
}) => {
  const [tiers, setTiers] = useState(settings.tiers)
  const [coordinators, setCoordinators] = useState(settings.coordinators)
  const [sdsMax, setSdsMax] = useState(settings.sdsMax)
  const [errors, setErrors] = useState<string[]>([])
  const [newTier, setNewTier] = useState('')
  const [newCoordinator, setNewCoordinator] = useState('')

  useEffect(() => {
    setTiers(settings.tiers)
    setCoordinators(settings.coordinators)
    setSdsMax(settings.sdsMax)
    setErrors([])
  }, [settings])

  const handleSave = () => {
    const next = {
      tiers: uniqueList(tiers),
      coordinators: uniqueList(coordinators),
      sdsMax,
    }
    const validation = validateSettings(next)
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }
    setErrors([])
    onSave(next)
  }

  return (
    <section className="hero">
      <div className="heroGrid">
        <div>
          <div className="h1">Settings</div>
          <p className="p">Manage tiers, coordinators, and SDS validation constraints.</p>
        </div>
        <div className="rightCard">
          <div className="miniTitle">Validation Rules</div>
          <ul className="miniList">
            <li>Tiers and coordinators are required.</li>
            <li>SDS max is configurable (default 30).</li>
            <li>Changes apply to new entries immediately.</li>
          </ul>
        </div>
      </div>

      <div className="sheetCard" style={{ marginTop: 16 }}>
        <div className="sheetHeader">
          <div>
            <div className="sheetTitle">Catalogs</div>
            <div className="sheetSubtitle">Update dropdown options without allowing free text.</div>
          </div>
        </div>
        <div style={cardBodyStyle}>
          <div style={gridCols(220)}>
            <div>
              <div style={labelStyle}>Tiers</div>
              {tiers.map((tier, index) => (
                <div key={tier} className="ctaRow" style={{ marginTop: 8 }}>
                  <input
                    value={tier}
                    onChange={(event) =>
                      setTiers((prev) => prev.map((item, i) => (i === index ? event.target.value : item)))
                    }
                    style={baseInputStyle}
                  />
                  <button
                    className="btnGhost"
                    onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="ctaRow" style={{ marginTop: 8 }}>
                <input
                  value={newTier}
                  onChange={(event) => setNewTier(event.target.value)}
                  placeholder="Add tier"
                  style={baseInputStyle}
                />
                <button
                  className="btnGhost"
                  onClick={() => {
                    if (!newTier.trim()) return
                    setTiers((prev) => [...prev, newTier.trim()])
                    setNewTier('')
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <div style={labelStyle}>Coordinators</div>
              {coordinators.map((coordinator, index) => (
                <div key={coordinator} className="ctaRow" style={{ marginTop: 8 }}>
                  <input
                    value={coordinator}
                    onChange={(event) =>
                      setCoordinators((prev) =>
                        prev.map((item, i) => (i === index ? event.target.value : item))
                      )
                    }
                    style={baseInputStyle}
                  />
                  <button
                    className="btnGhost"
                    onClick={() => setCoordinators((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="ctaRow" style={{ marginTop: 8 }}>
                <input
                  value={newCoordinator}
                  onChange={(event) => setNewCoordinator(event.target.value)}
                  placeholder="Add coordinator"
                  style={baseInputStyle}
                />
                <button
                  className="btnGhost"
                  onClick={() => {
                    if (!newCoordinator.trim()) return
                    setCoordinators((prev) => [...prev, newCoordinator.trim()])
                    setNewCoordinator('')
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div style={gridCols(200)}>
            <NumberField
              label="SDS Max"
              value={sdsMax}
              onChange={(value) => {
                const parsed = parseInteger(value)
                if (parsed !== null && !Number.isNaN(parsed)) {
                  setSdsMax(parsed)
                }
              }}
              min={1}
              max={60}
            />
          </div>

          {errors.length > 0 && (
            <div className="note" style={{ color: 'var(--pink)' }}>
              {errors.join(' ')}
            </div>
          )}

          <div className="ctaRow">
            <button className="btnPrimary" onClick={handleSave}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

const ImportExportView = ({
  state,
  onExport,
  onImport,
}: {
  state: AppState
  onExport: () => void
  onImport: (state: AppState) => void
}) => {
  const [errors, setErrors] = useState<string[]>([])
  const [importPreview, setImportPreview] = useState<AppState | null>(null)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as unknown
        const validation = validateImportedState(parsed)
        if (!validation.ok || !validation.state) {
          setErrors(validation.errors)
          setImportPreview(null)
          return
        }
        setErrors([])
        setImportPreview(validation.state)
      } catch {
        setErrors(['Invalid JSON file.'])
        setImportPreview(null)
      }
    }
    reader.readAsText(file)
  }

  return (
    <section className="hero">
      <div className="heroGrid">
        <div>
          <div className="h1">Import / Export</div>
          <p className="p">
            Export the full dataset as JSON for backups. Import validates schema, MRN uniqueness, and scale ranges.
          </p>
        </div>
        <div className="rightCard">
          <div className="miniTitle">Snapshot</div>
          <ul className="miniList">
            <li>Patients: {state.patients.length}</li>
            <li>Scores: {state.monthlyScores.length}</li>
            <li>Attendance records: {state.attendance.length}</li>
          </ul>
          <div className="ctaRow" style={{ marginTop: 12 }}>
            <button className="btnPrimary" onClick={onExport}>
              Export JSON
            </button>
          </div>
        </div>
      </div>

      <div className="sheetCard" style={{ marginTop: 16 }}>
        <div className="sheetHeader">
          <div>
            <div className="sheetTitle">Import JSON</div>
            <div className="sheetSubtitle">Upload a previously exported file to restore data.</div>
          </div>
        </div>
        <div style={cardBodyStyle}>
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {errors.length > 0 && (
            <div className="note" style={{ color: 'var(--pink)' }}>
              {errors.join(' ')}
            </div>
          )}
          {importPreview && (
            <div className="rightCard">
              <div className="miniTitle">Preview</div>
              <ul className="miniList">
                <li>Patients: {importPreview.patients.length}</li>
                <li>Scores: {importPreview.monthlyScores.length}</li>
                <li>Attendance records: {importPreview.attendance.length}</li>
              </ul>
              <div className="ctaRow" style={{ marginTop: 12 }}>
                <button className="btnPrimary" onClick={() => onImport(importPreview)}>
                  Confirm Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

const validateImportedState = (value: unknown): { ok: boolean; errors: string[]; state?: AppState } => {
  const errors: string[] = []
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['Import file must be a JSON object.'] }
  }
  const data = value as AppState
  if (!Array.isArray(data.patients) || !Array.isArray(data.monthlyScores) || !Array.isArray(data.attendance)) {
    return { ok: false, errors: ['Import is missing required arrays.'] }
  }
  const settings = data.settings ?? seedState.settings
  const settingsValidation = validateSettings(settings)
  if (!settingsValidation.ok) {
    errors.push(...settingsValidation.errors)
  }
  const patientErrors: string[] = []
  data.patients.forEach((patient) => {
    const validation = validatePatient(patient, data.patients, patient.patientId)
    if (!validation.ok) {
      patientErrors.push(`${patient.patientName || patient.mrn || 'Patient'}: ${validation.errors.join(' ')}`)
    }
  })
  if (patientErrors.length) {
    errors.push(...patientErrors)
  }
  data.attendance.forEach((entry) => {
    const validation = validateAttendance(entry)
    if (!validation.ok) {
      errors.push(`Attendance ${entry.patientId}: ${validation.errors.join(' ')}`)
    }
  })
  data.monthlyScores.forEach((score) => {
    const validation = validateMonthlyScore(score, settings)
    if (!validation.ok) {
      errors.push(
        `Score ${score.patientId} ${score.scaleType} ${monthLabel(score.monthIndex)}: ${validation.errors.join(' ')}`
      )
    }
  })
  if (errors.length) {
    return { ok: false, errors }
  }
  return { ok: true, errors: [], state: { ...data, settings, schemaVersion: 1 } }
}

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={baseInputStyle}
    />
  </div>
)

const NumberField = ({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: string) => void
  min?: number
  max?: number
}) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input
      type="number"
      min={min}
      max={max}
      step={1}
      inputMode="numeric"
      value={Number.isNaN(value) ? '' : value}
      onChange={(event) => onChange(event.target.value)}
      style={baseInputStyle}
      title={min !== undefined && max !== undefined ? `${min} - ${max}` : undefined}
    />
  </div>
)

const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <select value={value} onChange={(event) => onChange(event.target.value)} style={baseInputStyle}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
)

const DateField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={baseInputStyle}
    />
  </div>
)
