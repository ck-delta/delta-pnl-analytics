import Card from '../components/Card'

export default function TraderAdvice() {
  // Full scrollable AI advice will be built in Phase 5
  return (
    <div className="space-y-6">
      <Card>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🧠</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-on-bg)' }}>AI Trader Advice</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Scrollable AI-powered trading analysis coming in Phase 5.
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Score Card → What's Working → What's Not → How to Improve → Kelly Criterion → Bottom Line
          </p>
        </div>
      </Card>
    </div>
  )
}
