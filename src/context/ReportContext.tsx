import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react'
import type { DeltaReportData, LoadingProgress } from '../types/report'

export type ViewMode = 'wrapped' | 'dashboard'
export type TopTab = 'advice' | 'dashboard' | 'tradelog'

interface AppState {
  report: DeltaReportData | null
  viewMode: ViewMode
  topTab: TopTab
  activeTab: number       // dashboard sub-tab index (0-7)
  loading: boolean
  loadingProgress: LoadingProgress | null
  error: string | null
}

type Action =
  | { type: 'SET_LOADING' }
  | { type: 'SET_PROGRESS'; payload: LoadingProgress }
  | { type: 'SET_REPORT'; payload: DeltaReportData }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_TOP_TAB'; payload: TopTab }
  | { type: 'SET_TAB'; payload: number }
  | { type: 'CLEAR' }

const initialState: AppState = {
  report: null,
  viewMode: 'wrapped',
  topTab: 'advice',
  activeTab: 0,
  loading: false,
  loadingProgress: null,
  error: null,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true, error: null, loadingProgress: null }
    case 'SET_PROGRESS':
      return { ...state, loadingProgress: action.payload }
    case 'SET_REPORT':
      return { ...state, report: action.payload, loading: false, loadingProgress: null, error: null, viewMode: 'wrapped' }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload }
    case 'SET_TOP_TAB':
      return { ...state, topTab: action.payload, viewMode: 'dashboard' }
    case 'SET_TAB':
      return { ...state, activeTab: action.payload, topTab: 'dashboard', viewMode: 'dashboard' }
    case 'CLEAR':
      return initialState
    default:
      return state
  }
}

const ReportContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null)

export function ReportProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <ReportContext.Provider value={{ state, dispatch }}>
      {children}
    </ReportContext.Provider>
  )
}

export function useReport() {
  const ctx = useContext(ReportContext)
  if (!ctx) throw new Error('useReport must be used within ReportProvider')
  return ctx
}
