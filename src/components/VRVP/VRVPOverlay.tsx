import { useRef, useEffect } from 'react'
import type { VRVPData } from '@/types/chart'
import styles from './VRVPOverlay.module.css'

interface VRVPOverlayProps {
  data: VRVPData
  width: number
  height: number
  priceRange: { high: number; low: number } | null
  priceToCoordinate: (price: number) => number | null
}

const MAX_BAR_WIDTH_PERCENT = 0.20
const BAR_OPACITY = 0.25

export function VRVPOverlay({
  data,
  width,
  height,
  priceRange,
  priceToCoordinate,
}: VRVPOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !priceRange || data.levels.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const maxBarWidth = width * MAX_BAR_WIDTH_PERCENT
    const rightEdge = width - 50

    const rowHeight = (priceRange.high - priceRange.low) / data.levels.length

    for (const level of data.levels) {
      if (data.maxVolume === 0) continue

      const barWidth = (level.volume / data.maxVolume) * maxBarWidth
      if (barWidth < 1) continue

      const y = priceToCoordinate(level.price)
      if (y === null) continue

      // Skip if outside visible canvas area
      if (y < 0 || y > height) continue

      const barHeight = Math.max(1, Math.abs(
        (priceToCoordinate(level.price - rowHeight / 2) || y) -
        (priceToCoordinate(level.price + rowHeight / 2) || y)
      ))

      const barX = rightEdge - barWidth

      // Gray bars with low opacity
      ctx.fillStyle = `rgba(180, 180, 180, ${BAR_OPACITY})`
      ctx.fillRect(barX, y - barHeight / 2, barWidth, barHeight)
    }

    // POC line - keep it visible
    const pocY = priceToCoordinate(data.poc)
    if (pocY !== null && pocY >= 0 && pocY <= height) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 2])
      ctx.beginPath()
      ctx.moveTo(rightEdge - maxBarWidth - 10, pocY)
      ctx.lineTo(rightEdge, pocY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('POC', rightEdge - maxBarWidth - 28, pocY + 3)
    }

    // Value area - very subtle
    const vaHighY = priceToCoordinate(data.valueAreaHigh)
    const vaLowY = priceToCoordinate(data.valueAreaLow)

    if (vaHighY !== null && vaLowY !== null) {
      // Clamp to visible canvas area
      const clampedHighY = Math.max(0, vaHighY)
      const clampedLowY = Math.min(height, vaLowY)

      if (clampedLowY > clampedHighY) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.05)'
        ctx.fillRect(
          rightEdge - maxBarWidth,
          clampedHighY,
          maxBarWidth,
          clampedLowY - clampedHighY
        )

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])

        if (vaHighY >= 0 && vaHighY <= height) {
          ctx.beginPath()
          ctx.moveTo(rightEdge - maxBarWidth, vaHighY)
          ctx.lineTo(rightEdge, vaHighY)
          ctx.stroke()
        }

        if (vaLowY >= 0 && vaLowY <= height) {
          ctx.beginPath()
          ctx.moveTo(rightEdge - maxBarWidth, vaLowY)
          ctx.lineTo(rightEdge, vaLowY)
          ctx.stroke()
        }

        ctx.setLineDash([])
      }
    }
  }, [data, width, height, priceRange, priceToCoordinate])

  if (!priceRange || data.levels.length === 0) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      style={{ width, height }}
    />
  )
}
