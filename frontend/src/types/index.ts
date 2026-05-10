export type InspectionStatus = 'ok' | 'overdue' | 'missing'

export interface TemplateStatus {
  status: InspectionStatus
  last_completed: string | null
  audit_id: string | null
  inspector: string | null
}

export interface Site {
  name: string
  templates: Record<string, TemplateStatus>
}

export interface DashboardData {
  generated_at: string
  week_start: string
  week_end: string
  sites: Site[]
  summary: {
    total: number
    compliant: number
    has_gaps: number
  }
}

export interface InspectionSummary {
  audit_id: string
  template: string
  site: string
  date_completed: string
  inspector: string
  score: string | number
}

export interface AuditDetail {
  audit_id: string
  audit_data: {
    name: string
    score: number
    total_score: number
    score_percentage: number
    date_completed: string
    modified_at: string
    site: { name: string; id?: string }
    owner: { name?: string; id?: string } | string
  }
  items: Array<{
    item_id: string
    label: string
    type: string
    responses?: {
      text?: string
      selected?: Array<{ label: string; score?: number }>
    }
    note?: string
    score?: number
    max_score?: number
  }>
}
