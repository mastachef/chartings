import { useState, useEffect } from 'react'
import { getCountdownTimers, type CountdownTimers } from './KeyLevelsCalculator'
import styles from './KeyLevelsTimer.module.css'

export function KeyLevelsTimer() {
  const [timers, setTimers] = useState<CountdownTimers>(getCountdownTimers())

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(getCountdownTimers())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.timer}>
        <span className={styles.label} style={{ color: '#3b82f6' }}>D</span>
        <span className={styles.value}>{timers.daily}</span>
      </div>
      <div className={styles.timer}>
        <span className={styles.label} style={{ color: '#f59e0b' }}>W</span>
        <span className={styles.value}>{timers.weekly}</span>
      </div>
      <div className={styles.timer}>
        <span className={styles.label} style={{ color: '#a855f7' }}>M</span>
        <span className={styles.value}>{timers.monthly}</span>
      </div>
      <div className={styles.timer}>
        <span className={styles.label} style={{ color: '#ef4444' }}>Y</span>
        <span className={styles.value}>{timers.yearly}</span>
      </div>
    </div>
  )
}
