import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FavoriteTicker {
  symbol: string
}

interface FavoritesState {
  favorites: FavoriteTicker[]
  addFavorite: (symbol: string) => void
  removeFavorite: (symbol: string) => void
  isFavorite: (symbol: string) => boolean
  reorderFavorites: (fromIndex: number, toIndex: number) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [
        // Default favorites
        { symbol: 'BTCUSD' },
        { symbol: 'ETHUSD' },
        { symbol: 'SOLUSD' },
      ],

      addFavorite: (symbol) =>
        set((state) => {
          // Don't add duplicates
          if (state.favorites.some(f => f.symbol === symbol)) {
            return state
          }
          return { favorites: [...state.favorites, { symbol }] }
        }),

      removeFavorite: (symbol) =>
        set((state) => ({
          favorites: state.favorites.filter(f => f.symbol !== symbol),
        })),

      isFavorite: (symbol) => {
        return get().favorites.some(f => f.symbol === symbol)
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
