import { useGridStore } from '@/store/gridStore'
import type { LayoutPreset } from '@/types/chart'
import styles from './GridControls.module.css'

const presets: { value: LayoutPreset; label: string; icon: React.ReactNode }[] = [
  {
    value: '1x1',
    label: 'Single',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="2" width="16" height="16" rx="2" />
      </svg>
    ),
  },
  {
    value: '1x2',
    label: 'Horizontal Split',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="2" width="16" height="7" rx="1" />
        <rect x="2" y="11" width="16" height="7" rx="1" />
      </svg>
    ),
  },
  {
    value: '2x1',
    label: 'Vertical Split',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="2" width="7" height="16" rx="1" />
        <rect x="11" y="2" width="7" height="16" rx="1" />
      </svg>
    ),
  },
  {
    value: '2x2',
    label: 'Grid 2x2',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="2" width="7" height="7" rx="1" />
        <rect x="11" y="2" width="7" height="7" rx="1" />
        <rect x="2" y="11" width="7" height="7" rx="1" />
        <rect x="11" y="11" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    value: '3x2',
    label: 'Grid 3x2',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="2" width="4.5" height="7" rx="1" />
        <rect x="7.75" y="2" width="4.5" height="7" rx="1" />
        <rect x="13.5" y="2" width="4.5" height="7" rx="1" />
        <rect x="2" y="11" width="4.5" height="7" rx="1" />
        <rect x="7.75" y="11" width="4.5" height="7" rx="1" />
        <rect x="13.5" y="11" width="4.5" height="7" rx="1" />
      </svg>
    ),
  },
]

export function GridControls() {
  const { currentPreset, setPreset } = useGridStore()

  return (
    <div className={styles.controls}>
      <span className={styles.label}>Layout:</span>
      <div className={styles.presets}>
        {presets.map((preset) => (
          <button
            key={preset.value}
            className={`${styles.preset} ${currentPreset === preset.value ? styles.active : ''}`}
            onClick={() => setPreset(preset.value)}
            title={preset.label}
          >
            {preset.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
