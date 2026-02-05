interface MetricCardProps {
  label: string
  value: string | number
  subValue?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: React.ReactNode
}

export function MetricCard({ label, value, subValue, trend, trendValue, icon }: MetricCardProps) {
  const trendColors = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-slate-500 dark:text-slate-400'
  }

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    neutral: null
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 transition-all duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        {icon && (
          <span className="text-slate-400 dark:text-slate-500">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {subValue}
            </p>
          )}
        </div>

        {trend && trendValue && (
          <div className={`flex items-center gap-1 ${trendColors[trend]}`}>
            {trendIcons[trend]}
            <span className="text-sm font-medium">{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  )
}
