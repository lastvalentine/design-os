import type { DailySyncStat } from '@/../product/sections/monitoring-compliance/types'

interface SyncChartProps {
  data: DailySyncStat[]
  title?: string
}

export function SyncChart({ data, title = 'Sync Activity (7 Days)' }: SyncChartProps) {
  const maxValue = Math.max(...data.map(d => d.successful + d.failed))

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
        {title}
      </h3>

      <div className="flex items-end justify-between gap-2 h-32">
        {data.map((day) => {
          const totalHeight = ((day.successful + day.failed) / maxValue) * 100
          const successHeight = (day.successful / (day.successful + day.failed)) * totalHeight
          const failHeight = (day.failed / (day.successful + day.failed)) * totalHeight
          const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full flex flex-col justify-end rounded-t-md overflow-hidden"
                style={{ height: `${totalHeight}%`, minHeight: '4px' }}
              >
                {day.failed > 0 && (
                  <div
                    className="w-full bg-red-400 dark:bg-red-500 transition-all duration-300"
                    style={{ height: `${failHeight}%`, minHeight: day.failed > 0 ? '2px' : '0' }}
                  />
                )}
                <div
                  className="w-full bg-amber-400 dark:bg-amber-500 transition-all duration-300"
                  style={{ height: `${successHeight}%` }}
                />
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {dayLabel}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Successful</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Failed</span>
        </div>
      </div>
    </div>
  )
}
