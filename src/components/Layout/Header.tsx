import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
          <polyline points="16,7 22,7 22,13" />
        </svg>
        <span className={styles.title}>Trading Charts</span>
      </div>
      <div className={styles.info}>
        <span className={styles.hint}>Drag charts to reposition</span>
      </div>
    </header>
  )
}
