export interface ScanHistoryRecord {
  id: string
  user_id: string | null
  token_name: string
  token_address?: string | null
  token_symbol?: string | null
  score: number
  risk_level: string
  created_at: string
  liquidity?: number | null
  volume?: number | null
  holders?: number | null
  confidence?: string | null
  signals?: string[] | null
}

export interface PortfolioRecord {
  id: string
  user_id: string
  token_address: string
  token_name: string
  token_symbol?: string | null
  quantity: number
  entry_price: number
  current_price?: number | null
  status: string
  risk_level: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface PriceAlertRecord {
  id: string
  user_id: string
  token_address: string
  token_name?: string | null
  alert_type: string
  comparison_type: string
  threshold: number
  is_active: boolean
  trigger_count: number
  last_triggered_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreatePortfolioPayload {
  token_address: string
  token_name: string
  token_symbol?: string | null
  quantity: number
  entry_price: number
  risk_level: string
  notes?: string
}

export interface CreateAlertPayload {
  token_address: string
  token_name?: string
  alert_type: string
  comparison_type: string
  threshold: number
}
