export interface ReadOnlyColumn {
  key: string
  label: string
  /** CSS grid track, e.g. 80px or minmax(0, 1fr). */
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface ReadOnlyRow {
  key?: string | number
  remark?: string
  [key: string]: unknown
}
