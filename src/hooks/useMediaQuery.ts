import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

export function useBreakpoint() {
  const isXs = useMediaQuery('(max-width: 480px)')
  const isSm = useMediaQuery('(max-width: 768px)')
  const isMd = useMediaQuery('(max-width: 996px)')
  const isLg = useMediaQuery('(max-width: 1200px)')

  return {
    isXs,
    isSm,
    isMd,
    isLg,
    isMobile: isSm,
    isTablet: isMd && !isSm,
    isDesktop: !isMd,
  }
}
