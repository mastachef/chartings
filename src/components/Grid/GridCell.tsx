import { useCallback } from 'react'
import { ChartContainer } from '../Chart/ChartContainer'
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary'
import { useChartStore } from '@/store/chartStore'
import type { ChartConfig } from '@/types/chart'
import styles from './GridCell.module.css'

interface GridCellProps {
  chartId: string
}

export function GridCell({ chartId }: GridCellProps) {
  const chart = useChartStore((state) => state.charts[chartId])
  const updateChart = useChartStore((state) => state.updateChart)
  const setActiveChart = useChartStore((state) => state.setActiveChart)

  const handleConfigChange = useCallback(
    (updates: Partial<ChartConfig>) => {
      updateChart(chartId, updates)
    },
    [chartId, updateChart]
  )

  const handleFocus = useCallback(() => {
    setActiveChart(chartId)
  }, [chartId, setActiveChart])

  if (!chart) {
    return <div className={styles.empty}>Loading...</div>
  }

  return (
    <div className={styles.cell} onClick={handleFocus}>
      <div className={`${styles.dragHandle} drag-handle`} aria-label="Drag to reorder">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="4" cy="12" r="1.5" />
          <circle cx="8" cy="4" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
          <circle cx="12" cy="4" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      </div>
      <ErrorBoundary>
        <ChartContainer config={chart} onConfigChange={handleConfigChange} />
      </ErrorBoundary>
    </div>
  )
}
