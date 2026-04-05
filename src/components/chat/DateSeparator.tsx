import { format, isToday, isYesterday } from 'date-fns'

interface DateSeparatorProps {
  date: string
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

/** Horizontal rule with a date label centered inside it. Server Component safe. */
export default function DateSeparator({ date }: DateSeparatorProps) {
  const label = formatDateLabel(new Date(date))

  return (
    <div className="flex items-center gap-3 px-4 py-3" role="separator">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}