import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DataSource } from '@/types/chart'

export interface FavoriteTicker {
  symbol: string
  dataSource: DataSource
}

interface FavoritesState {
  favorites: FavoriteTicker[]
  addFavorite: (ticker: FavoriteTicker) => void
  removeFavorite: (symbol: string, dataSource: DataSource) => void
  isFavorite: (symbol: string, dataSource: DataSource) => boolean
  reorderFavorites: (fromIndex: number, toIndex: number) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [
        // Default favorites
        { symbol: 'BTCUSD', dataSource: 'binance' },
        { symbol: 'ETHUSD', dataSource: 'binance' },
        { symbol: 'SOLUSD', dataSource: 'binance' },
      ],

      addFavorite: (ticker) =>
        set((state) => {
          // Don't add duplicates
          if (state.favorites.some(f => f.symbol === ticker.symbol && f.dataSource === ticker.dataSource)) {
            return state
          }
          return { favorites: [...state.favorites, ticker] }
        }),

      removeFavorite: (symbol, dataSource) =>
        set((state) => ({
          favorites: state.favorites.filter(f => !(f.symbol === symbol && f.dataSource === dataSource)),
        })),

      isFavorite: (symbol, dataSource) => {
        return get().favorites.some(f => f.symbol === symbol && f.dataSource === dataSource)
      },

      reorderFavorites: (fromIndex, toIndex) =>
        set((state) => {
          const newFavorites = [...state.favorites]
          const [moved] = newFavorites.splice(fromIndex, 1)
          newFavorites.splice(toIndex, 0, moved)
          return { favorites: newFavorites }
        }),
    }),
    {
      name: 'favorites-storage',
    }
  )
)
