import { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Play, Pause } from 'lucide-react'
import Card from './Card'
import ChartWrapper, { darkTooltipStyle } from './ChartWrapper'
import { formatCurrency, formatCurrencyFull, formatDate } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'

interface DataPoint {
  date: string
  cumulative: number
}

interface Props {
  equityCurve: DataPoint[]
}

const SPEED_OPTIONS = [1, 2, 5, 10] as const

export default function TradeReplay({ equityCurve }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState(equityCurve.length)
  const [speed, setSpeed] = useState<number>(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevValue = useRef(0)

  const totalFrames = equityCurve.length
  const displayData = equityCurve.slice(0, frameIndex)
  const currentPoint = displayData.length > 0 ? displayData[displayData.length - 1] : null
  const currentPnl = currentPoint?.cumulative ?? 0
  const isGrowing = currentPnl > prevValue.current

  useEffect(() => {
    prevValue.current = currentPnl
  }, [currentPnl])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const play = useCallback(() => {
    stop()
    // Reset to start if at end
    if (frameIndex >= totalFrames) {
      setFrameIndex(1)
    }
    setIsPlaying(true)
  }, [frameIndex, totalFrames, stop])

  useEffect(() => {
    if (!isPlaying) return
    const ms = Math.max(16, 80 / speed)
    intervalRef.current = setInterval(() => {
      setFrameIndex(prev => {
        if (prev >= totalFrames) {
          stop()
          return totalFrames
        }
        return prev + 1
      })
    }, ms)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, speed, totalFrames, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (equityCurve.length === 0) return null

  const strokeColor = currentPnl >= 0 ? '#00a876' : '#eb5454'
  const glowColor = isGrowing ? '#00a87640' : '#eb545440'

  return (
    <Card title="Trade Replay">
      {/* Chart */}
      <div style={{ filter: isPlaying ? `drop-shadow(0 0 12px ${glowColor})` : 'none', transition: 'filter 0.3s ease' }}>
        <ChartWrapper height={300}>
          <AreaChart data={displayData}>
            <defs>
              <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#71747a', fontSize: 10 }}
              tickFormatter={(v: string) => v.slice(5, 10)}
            />
            <YAxis
              tick={{ fill: '#71747a', fontSize: 10 }}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={strokeColor}
              fill="url(#replayGrad)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartWrapper>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Scrubber */}
        <input
          type="range"
          min={1}
          max={totalFrames}
          value={frameIndex}
          onChange={(e) => {
            stop()
            setFrameIndex(Number(e.target.value))
          }}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-brand) 0%, var(--color-brand) ${(frameIndex / totalFrames) * 100}%, var(--color-bg-tertiary) ${(frameIndex / totalFrames) * 100}%, var(--color-bg-tertiary) 100%)`,
            accentColor: 'var(--color-brand)',
          }}
        />

        <div className="flex items-center justify-between">
          {/* Play/Pause + Speed */}
          <div className="flex items-center gap-3">
            <button
              onClick={isPlaying ? stop : play}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-brand)', color: '#fff' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
            </button>

            <div className="flex items-center gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className="px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors"
                  style={{
                    background: speed === s ? 'var(--color-brand-muted)' : 'var(--color-bg-secondary)',
                    color: speed === s ? 'var(--color-brand-text)' : 'var(--color-text-tertiary)',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Live stats */}
          <div className="flex items-center gap-6">
            {currentPoint && (
              <>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Date</div>
                  <div className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(currentPoint.date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>P&L</div>
                  <div
                    className="text-sm font-mono font-bold"
                    style={{ color: currentPnl >= 0 ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}
                  >
                    {formatCurrencyFull(currentPnl)}
                  </div>
                </div>
              </>
            )}
            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Progress</div>
              <div className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {frameIndex}/{totalFrames}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
