import { useFavoritesStore, type FavoriteTicker } from '@/store/favoritesStore'
import styles from './FavoritesBar.module.css'

interface FavoritesBarProps {
  currentTicker: string
  onSelectTicker: (ticker: string) => void
}

export function FavoritesBar({ currentTicker, onSelectTicker }: FavoritesBarProps) {
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritesStore()

  const isCurrentFavorite = isFavorite(currentTicker)

  const handleAddCurrent = () => {
    addFavorite(currentTicker)
  }

  const handleRemove = (e: React.MouseEvent, fav: FavoriteTicker) => {
    e.stopPropagation()
    removeFavorite(fav.symbol)
  }

  const handleSelect = (fav: FavoriteTicker) => {
    onSelectTicker(fav.symbol)
  }

  return (
    <div className={styles.container}>
      <div className={styles.favorites}>
        {favorites.map((fav) => {
          const isActive = fav.symbol === currentTicker
          return (
            <button
              key={fav.symbol}
              className={`${styles.favItem} ${isActive ? styles.active : ''}`}
              onClick={() => handleSelect(fav)}
              title={fav.symbol}
            >
              <span className={styles.symbol}>{fav.symbol.replace(/USD$/, '')}</span>
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemove(e, fav)}
                title="Remove from favorites"
              >
                ×
              </button>
            </button>
          )
        })}
      </div>
      {!isCurrentFavorite && (
        <button
          className={styles.addBtn}
          onClick={handleAddCurrent}
          title={`Add ${currentTicker} to favorites`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Add {currentTicker.replace(/USD$/, '')}</span>
        </button>
      )}
    </div>
  )
}
