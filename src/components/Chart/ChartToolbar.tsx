import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChartConfig, Timeframe, DataSource } from '@/types/chart'
import { searchYahooSymbols } from '@/api/yahoo/yahooApi'
import { searchCoinGeckoSymbols } from '@/api/crypto/coinGeckoApi'
import styles from './ChartToolbar.module.css'

interface ChartToolbarProps {
  config: ChartConfig
  onConfigChange: (updates: Partial<ChartConfig>) => void
  onResetView?: () => void
}

interface TickerSuggestion {
  symbol: string
  name: string
}

const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '3d', '1w', '1M', '3M']

// Popular stocks/ETFs/commodities for suggestions (Yahoo Finance)
const stockSuggestions: TickerSuggestion[] = [
  // Indices
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF' },
  { symbol: 'IWM', name: 'Russell 2000 ETF' },
  { symbol: 'DX-Y.NYB', name: 'US Dollar Index (DXY)' },
  // Precious Metals
  { symbol: 'GC=F', name: 'Gold Futures' },
  { symbol: 'SI=F', name: 'Silver Futures' },
  { symbol: 'GLD', name: 'Gold ETF (SPDR)' },
  { symbol: 'SLV', name: 'Silver ETF (iShares)' },
  { symbol: 'PAXG', name: 'Pax Gold' },
  // Energy
  { symbol: 'CL=F', name: 'Crude Oil Futures' },
  { symbol: 'NG=F', name: 'Natural Gas Futures' },
  { symbol: 'USO', name: 'Oil Fund ETF' },
  // Currencies
  { symbol: 'EURUSD=X', name: 'EUR/USD' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD' },
  { symbol: 'USDJPY=X', name: 'USD/JPY' },
  // Popular Stocks
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'AMD', name: 'AMD' },
  // Bonds
  { symbol: 'TLT', name: '20+ Year Treasury ETF' },
  { symbol: 'BND', name: 'Total Bond Market ETF' },
]

// Common crypto pairs for suggestions
const cryptoSuggestions: TickerSuggestion[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin' },
  { symbol: 'ETHUSD', name: 'Ethereum' },
  { symbol: 'SOLUSD', name: 'Solana' },
  { symbol: 'HYPEUSD', name: 'Hyperliquid' },
  { symbol: 'XRPUSD', name: 'Ripple' },
  { symbol: 'ADAUSD', name: 'Cardano' },
  { symbol: 'DOGEUSD', name: 'Dogecoin' },
  { symbol: 'AVAXUSD', name: 'Avalanche' },
  { symbol: 'DOTUSD', name: 'Polkadot' },
  { symbol: 'LINKUSD', name: 'Chainlink' },
  { symbol: 'MATICUSD', name: 'Polygon' },
  { symbol: 'BNBUSD', name: 'BNB' },
  { symbol: 'LTCUSD', name: 'Litecoin' },
  { symbol: 'ARBUSD', name: 'Arbitrum' },
  { symbol: 'OPUSD', name: 'Optimism' },
  { symbol: 'SUIUSD', name: 'Sui' },
  { symbol: 'APTUSD', name: 'Aptos' },
  { symbol: 'INJUSD', name: 'Injective' },
  { symbol: 'TIAUSD', name: 'Celestia' },
  { symbol: 'SEIUSD', name: 'Sei' },
  { symbol: 'JUPUSD', name: 'Jupiter' },
  { symbol: 'PYTHUSD', name: 'Pyth Network' },
  { symbol: 'WIFUSD', name: 'dogwifhat' },
  { symbol: 'PEPEUSD', name: 'Pepe' },
  { symbol: 'BONKUSD', name: 'Bonk' },
  { symbol: 'FARTCOINUSD', name: 'Fartcoin' },
  { symbol: 'AI16ZUSD', name: 'ai16z' },
  { symbol: 'VIRTUALUSD', name: 'Virtual Protocol' },
  { symbol: 'GOATUSD', name: 'Goatseus Maximus' },
  { symbol: 'TRUMPUSD', name: 'Official Trump' },
  { symbol: 'MELANIAUSD', name: 'Official Melania' },
  { symbol: 'POPCATUSD', name: 'Popcat' },
  { symbol: 'MEWUSD', name: 'Cat in a Dogs World' },
  { symbol: 'PNUTUSD', name: 'Peanut the Squirrel' },
]

export function ChartToolbar({ config, onConfigChange, onResetView }: ChartToolbarProps) {
  const [tickerInput, setTickerInput] = useState(config.ticker)
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const suggestionClickedRef = useRef(false)
  const searchVersionRef = useRef(0) // Track search version to prevent race conditions

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setTickerInput(value)
    setSelectedIndex(-1)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Increment search version to invalidate pending searches
    const currentVersion = ++searchVersionRef.current

    if (value.length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Filter suggestions based on input
    if (config.dataSource === 'binance') {
      // Show local suggestions immediately
      const filtered = cryptoSuggestions.filter(
        s => s.symbol.includes(value) || s.name.toUpperCase().includes(value)
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)

      // Also search CoinGecko for more results (debounced)
      searchTimeoutRef.current = window.setTimeout(async () => {
        if (value.length >= 2) {
          const results = await searchCoinGeckoSymbols(value)
          // Only update if this is still the latest search
          if (searchVersionRef.current !== currentVersion) return
          // Merge with local, avoiding duplicates
          const localSymbols = new Set(filtered.map(s => s.symbol.toUpperCase()))
          const newResults = results.filter(r => !localSymbols.has(r.symbol.toUpperCase()))
          const merged = [...filtered, ...newResults]
          setSuggestions(merged)
          setShowSuggestions(merged.length > 0)
        }
      }, 300)
    } else {
      // Show local stock suggestions immediately
      const localFiltered = stockSuggestions.filter(
        s => s.symbol.toUpperCase().includes(value) || s.name.toUpperCase().includes(value)
      )
      setSuggestions(localFiltered)
      setShowSuggestions(localFiltered.length > 0)

      // Also search Yahoo API for more results (debounced)
      searchTimeoutRef.current = window.setTimeout(async () => {
        if (value.length >= 2) {
          const results = await searchYahooSymbols(value)
          // Only update if this is still the latest search
          if (searchVersionRef.current !== currentVersion) return
          // Merge with local, avoiding duplicates
          const localSymbols = new Set(localFiltered.map(s => s.symbol.toUpperCase()))
          const newResults = results.filter(r => !localSymbols.has(r.symbol.toUpperCase()))
          const merged = [...localFiltered, ...newResults]
          setSuggestions(merged)
          setShowSuggestions(merged.length > 0)
        }
      }, 300)
    }
  }

  const selectSuggestion = useCallback((suggestion: TickerSuggestion) => {
    suggestionClickedRef.current = true
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(-1)
    // Don't set tickerInput here - let the useEffect handle it from config.ticker
    onConfigChange({ ticker: suggestion.symbol })
    inputRef.current?.blur()
    // Reset flag after blur handler would have run
    setTimeout(() => {
      suggestionClickedRef.current = false
    }, 300)
  }, [onConfigChange])

  const submitTicker = () => {
    if (tickerInput.trim() && tickerInput.trim() !== config.ticker) {
      onConfigChange({ ticker: tickerInput.trim() })
    }
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex])
        } else {
          submitTicker()
          inputRef.current?.blur()
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitTicker()
        inputRef.current?.blur()
      } else if (e.key === 'Escape') {
        setTickerInput(config.ticker)
        inputRef.current?.blur()
      }
    }
  }

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      // Don't do anything if a suggestion was clicked
      if (suggestionClickedRef.current) {
        return
      }
      // Just hide suggestions and reset input to current ticker
      setShowSuggestions(false)
      setTickerInput(config.ticker)
    }, 150)
  }

  const handleFocus = () => {
    if (tickerInput.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleDataSourceChange = (dataSource: DataSource) => {
    const newTicker = dataSource === 'binance' ? 'BTCUSD' : 'AAPL'
    setTickerInput(newTicker)
    setSuggestions([])
    setShowSuggestions(false)
    onConfigChange({ dataSource, ticker: newTicker })
  }

  useEffect(() => {
    setTickerInput(config.ticker)
  }, [config.ticker])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <div className={styles.dataSourceToggle} role="group" aria-label="Data source">
          <button
            className={`${styles.sourceBtn} ${config.dataSource === 'binance' ? styles.active : ''}`}
            onClick={() => handleDataSourceChange('binance')}
            aria-pressed={config.dataSource === 'binance'}
            aria-label="Switch to cryptocurrency data"
          >
            Crypto
          </button>
          <button
            className={`${styles.sourceBtn} ${config.dataSource === 'yahoo' ? styles.active : ''}`}
            onClick={() => handleDataSourceChange('yahoo')}
            aria-pressed={config.dataSource === 'yahoo'}
            aria-label="Switch to stock market data"
          >
            Stocks
          </button>
        </div>

        <div className={styles.tickerWrapper}>
          <label htmlFor="ticker-input" className="sr-only">Ticker symbol</label>
          <input
            id="ticker-input"
            ref={inputRef}
            type="text"
            value={tickerInput}
            onChange={handleTickerChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={config.dataSource === 'binance' ? 'BTCUSD' : 'AAPL'}
            className={styles.tickerInput}
            autoComplete="off"
            aria-label="Enter ticker symbol"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionsRef} className={styles.suggestions}>
              {suggestions.slice(0, 8).map((suggestion, index) => (
                <div
                  key={suggestion.symbol}
                  className={`${styles.suggestionItem} ${index === selectedIndex ? styles.selected : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault() // Prevent blur from firing
                    selectSuggestion(suggestion)
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={styles.suggestionSymbol}>{suggestion.symbol}</span>
                  <span className={styles.suggestionName}>{suggestion.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {onResetView && (
          <button
            className={styles.resetBtn}
            onClick={onResetView}
            title="Reset view"
            aria-label="Reset chart view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 3v6h6M21 21v-6h-6M3 12a9 9 0 0 1 15-6.7L21 9M21 12a9 9 0 0 1-15 6.7L3 15" />
            </svg>
          </button>
        )}

      </div>

      <div className={styles.center}>
        <div className={styles.timeframes} role="group" aria-label="Timeframe selection">
          {timeframes.map((tf) => (
            <button
              key={tf}
              className={`${styles.tfBtn} ${config.timeframe === tf ? styles.active : ''}`}
              onClick={() => onConfigChange({ timeframe: tf })}
              aria-pressed={config.timeframe === tf}
              aria-label={`${tf} timeframe`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.right} role="group" aria-label="Chart indicators">
        <button
          className={`${styles.indicatorBtn} ${config.showKeyLevels ? styles.activeKey : ''}`}
          onClick={() => onConfigChange({ showKeyLevels: !config.showKeyLevels })}
          title="Toggle Key Levels (D/W/M)"
          aria-pressed={config.showKeyLevels}
          aria-label="Toggle Key Levels indicator"
        >
          Levels
        </button>
        <button
          className={`${styles.indicatorBtn} ${config.showGuppy ? styles.activeGuppy : ''}`}
          onClick={() => onConfigChange({ showGuppy: !config.showGuppy })}
          title="Toggle Guppy MMA"
          aria-pressed={config.showGuppy}
          aria-label="Toggle Guppy Multiple Moving Average indicator"
        >
          Guppy
        </button>
        <button
          className={`${styles.indicatorBtn} ${config.showRSI ? styles.activeRsi : ''}`}
          onClick={() => onConfigChange({ showRSI: !config.showRSI })}
          title="Toggle RSI (14)"
          aria-pressed={config.showRSI}
          aria-label="Toggle Relative Strength Index indicator"
        >
          RSI
        </button>
        <button
          className={`${styles.indicatorBtn} ${config.showHullSuite ? styles.activeHull : ''}`}
          onClick={() => onConfigChange({ showHullSuite: !config.showHullSuite })}
          title="Toggle Hull Suite"
          aria-pressed={config.showHullSuite}
          aria-label="Toggle Hull Suite indicator"
        >
          Hull
        </button>
        <button
          className={`${styles.indicatorBtn} ${config.showVRVP ? styles.activeVrvp : ''}`}
          onClick={() => onConfigChange({ showVRVP: !config.showVRVP })}
          title="Toggle Volume Profile"
          aria-pressed={config.showVRVP}
          aria-label="Toggle Visible Range Volume Profile indicator"
        >
          VRVP
        </button>
        {config.ticker.toUpperCase().includes('BTC') && (
          <button
            className={`${styles.indicatorBtn} ${config.showBTCCost ? styles.activeCost : ''}`}
            onClick={() => onConfigChange({ showBTCCost: !config.showBTCCost })}
            title="Toggle BTC Production Cost (Mining Cost)"
            aria-pressed={config.showBTCCost}
            aria-label="Toggle Bitcoin Production Cost indicator"
          >
            Cost
          </button>
        )}
      </div>
    </div>
  )
}
