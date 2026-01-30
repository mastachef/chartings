import { useCallback, useEffect, useMemo, useState } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useGridStore, layoutPresets } from '@/store/gridStore'
import { useChartStore } from '@/store/chartStore'
import { useBreakpoint } from '@/hooks/useMediaQuery'
import { GridCell } from './GridCell'
import { GridControls } from './GridControls'
import type { GridLayout as GridLayoutType } from '@/types/chart'
import styles from './ChartGrid.module.css'

const ROW_HEIGHT = 60
const MOBILE_ROW_HEIGHT = 50

export function ChartGrid() {
  const { layouts, setLayouts, currentPreset } = useGridStore()
  const { charts, addChart } = useChartStore()
  const { isMobile, isTablet } = useBreakpoint()
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth - 32 : 1200
  )

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const padding = isMobile ? 16 : 32
      setContainerWidth(window.innerWidth - padding)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobile])

  const responsiveCols = useMemo(() => {
    if (isMobile) return 4
    if (isTablet) return 6
    return 12
  }, [isMobile, isTablet])

  const rowHeight = isMobile ? MOBILE_ROW_HEIGHT : ROW_HEIGHT

  useEffect(() => {
    layouts.forEach((layout) => {
      if (!charts[layout.i]) {
        addChart(layout.i)
      }
    })
  }, [layouts, charts, addChart])

  const handleLayoutChange = useCallback(
    (newLayout: GridLayoutType[]) => {
      const updatedLayouts = newLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }))
      setLayouts(updatedLayouts)
    },
    [setLayouts]
  )

  const responsiveLayouts = useMemo(() => {
    if (isMobile) {
      return layouts.map((layout, index) => ({
        ...layout,
        x: 0,
        y: index * 6,
        w: 4,
        h: 6,
      }))
    }
    if (isTablet) {
      const preset = layoutPresets[currentPreset]
      if (preset.length === 1) {
        return layouts.map((layout) => ({
          ...layout,
          x: 0,
          w: 6,
        }))
      }
      return layouts.map((layout, index) => ({
        ...layout,
        x: 0,
        y: index * 6,
        w: 6,
        h: 6,
      }))
    }
    return layouts
  }, [layouts, isMobile, isTablet, currentPreset])

  const containerHeight = useMemo(() => {
    if (responsiveLayouts.length === 0) return 400
    const maxY = Math.max(...responsiveLayouts.map((l) => l.y + l.h))
    return maxY * rowHeight + 20
  }, [responsiveLayouts, rowHeight])

  return (
    <div className={styles.container}>
      <GridControls />
      <div className={styles.gridWrapper} style={{ minHeight: containerHeight }}>
        <GridLayout
          className={styles.grid}
          layout={responsiveLayouts}
          cols={responsiveCols}
          rowHeight={rowHeight}
          width={containerWidth}
          margin={isMobile ? [4, 4] : [8, 8]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          isDraggable={!isMobile}
          isResizable={!isMobile}
          draggableHandle=".drag-handle"
        >
          {responsiveLayouts.map((layout) => (
            <div key={layout.i} className={styles.gridItem}>
              <GridCell chartId={layout.i} />
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  )
}
