import { Flame, Trophy, TrendingUp, TrendingDown, Calendar, Target, Zap, Award, Star, Shield, Crosshair, BarChart3, Activity, Clock, Lock } from 'lucide-react'
import Card from './Card'
import { cn, formatDate } from '../lib/utils'
import type { StreakData, Achievement } from '../types/report'

interface Props {
  streaks: StreakData
}

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  trophy: Trophy,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  calendar: Calendar,
  target: Target,
  zap: Zap,
  award: Award,
  star: Star,
  shield: Shield,
  crosshair: Crosshair,
  bar_chart: BarChart3,
  activity: Activity,
  clock: Clock,
  flame: Flame,
  fire: Flame,
}

function getAchievementIcon(iconName: string) {
  const normalized = iconName.toLowerCase().replace(/[-\s]/g, '_')
  return ICON_MAP[normalized] ?? Award
}

function fireEmojis(count: number): string {
  if (count >= 10) return '     '
  if (count >= 7) return '    '
  if (count >= 5) return '   '
  if (count >= 3) return '  '
  if (count >= 1) return ' '
  return ''
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const Icon = getAchievementIcon(achievement.icon)
  const unlocked = achievement.unlocked

  return (
    <div
      className={cn(
        'shrink-0 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all w-[130px]',
        unlocked && 'ring-1',
      )}
      style={{
        background: unlocked ? 'var(--color-bg-surface-alt)' : 'var(--color-bg-primary)',
        borderColor: unlocked ? 'var(--color-brand)' : 'var(--color-separator)',
        outlineColor: unlocked ? 'var(--color-brand-muted)' : 'transparent',
        filter: unlocked ? 'none' : 'grayscale(100%)',
        opacity: unlocked ? 1 : 0.4,
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: unlocked
            ? 'linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))'
            : 'var(--color-bg-secondary)',
        }}
      >
        {unlocked
          ? <Icon size={20} style={{ color: '#fff' }} />
          : <Lock size={16} style={{ color: 'var(--color-text-quaternary)' }} />
        }
      </div>

      <div className="text-center">
        <div className="text-xs font-semibold truncate w-full" style={{ color: unlocked ? 'var(--color-text-primary)' : 'var(--color-text-quaternary)' }}>
          {achievement.name}
        </div>
        <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
          {achievement.description}
        </div>
        {unlocked && achievement.unlocked_date && (
          <div className="text-[9px] mt-1 font-mono" style={{ color: 'var(--color-brand-text)' }}>
            {formatDate(achievement.unlocked_date)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StreakTracker({ streaks }: Props) {
  return (
    <div className="space-y-6">
      {/* Current Streaks */}
      <Card title="Current Streaks">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Win Streak */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: streaks.current_win_streak > 0 ? 'var(--color-positive-muted)' : 'var(--color-bg-surface-alt)',
              borderColor: streaks.current_win_streak > 0 ? 'var(--color-positive)' : 'var(--color-separator)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} style={{ color: streaks.current_win_streak > 0 ? '#f97316' : 'var(--color-text-quaternary)' }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                Win Streak
              </span>
            </div>
            <div className="font-mono text-2xl font-bold" style={{ color: 'var(--color-positive-text)' }}>
              {streaks.current_win_streak}{fireEmojis(streaks.current_win_streak)}
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Best: {streaks.best_win_streak} consecutive wins
            </div>
          </div>

          {/* Loss Streak */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: streaks.current_loss_streak > 0 ? 'var(--color-negative-muted)' : 'var(--color-bg-surface-alt)',
              borderColor: streaks.current_loss_streak > 0 ? 'var(--color-negative)' : 'var(--color-separator)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} style={{ color: streaks.current_loss_streak > 0 ? 'var(--color-negative-text)' : 'var(--color-text-quaternary)' }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                Loss Streak
              </span>
            </div>
            <div className="font-mono text-2xl font-bold" style={{ color: 'var(--color-negative-text)' }}>
              {streaks.current_loss_streak}
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Worst: {streaks.worst_loss_streak} consecutive losses
            </div>
          </div>

          {/* Month Streak */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: streaks.profitable_month_streak > 0 ? 'var(--color-brand-muted)' : 'var(--color-bg-surface-alt)',
              borderColor: streaks.profitable_month_streak > 0 ? 'var(--color-brand)' : 'var(--color-separator)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} style={{ color: streaks.profitable_month_streak > 0 ? 'var(--color-brand-text)' : 'var(--color-text-quaternary)' }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                Profitable Months
              </span>
            </div>
            <div className="font-mono text-2xl font-bold" style={{ color: 'var(--color-brand-text)' }}>
              {streaks.profitable_month_streak}
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Best: {streaks.best_month_streak} consecutive months
            </div>
          </div>
        </div>
      </Card>

      {/* Achievements */}
      {streaks.achievements.length > 0 && (
        <Card title="Achievements">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} style={{ color: 'var(--color-brand-text)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {streaks.achievements.filter(a => a.unlocked).length}/{streaks.achievements.length} unlocked
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {/* Unlocked first, then locked */}
            {[...streaks.achievements]
              .sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1))
              .map((achievement) => (
                <AchievementBadge key={achievement.id} achievement={achievement} />
              ))
            }
          </div>
        </Card>
      )}
    </div>
  )
}
