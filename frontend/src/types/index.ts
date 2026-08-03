export const COLUMNS = ['EXCAVATOR', 'LOLER', 'DUMPER', 'ROLLER', 'TELEHAND', 'PUWER', 'SITE SUP', 'HAVS', 'TOOLBOX']
export const ABBREV: Record<string, string> = {
  EXCAVATOR: 'EXC', LOLER: 'LOL', DUMPER: 'DMP', ROLLER: 'ROL',
  TELEHAND: 'TLH', PUWER: 'PUW', 'SITE SUP': 'SUP', HAVS: 'HVS', TOOLBOX: 'TBX',
}

export type InspectionStatus = 'ok' | 'overdue' | 'missing'

export interface TemplateStatus {
  status: InspectionStatus
  last_completed: string | null
  audit_id: string | null
  inspector: string | null
  found_serials?: string[]
  register_only?: boolean
  puwer_cross_check?: { in_puwer_not_individual: string[]; in_individual_not_puwer: string[] } | null
  puwer_photo_uploaded?: boolean
  loler_report_uploaded?: boolean
}

export interface Site {
  name: string
  job_code?: string
  supervisor?: string
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
    date_modified: string
    site: { name: string; area?: { name: string } }
    authorship?: { author?: string; owner?: string; author_id?: string }
  }
  header_items: Array<{
    item_id: string
    label: string
    type: string
    responses?: {
      text?: string
      datetime?: string
      selected?: Array<{ id: string; label?: string }>
    }
  }>
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
