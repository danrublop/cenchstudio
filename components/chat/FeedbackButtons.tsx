import { ThumbsUp, ThumbsDown } from 'lucide-react'
import type { ChatMessage } from '@/lib/agents/types'

export interface FeedbackButtonsProps {
  msg: ChatMessage
  onRate: (msgId: string, rating: number) => void
}

export function FeedbackButtons({ msg, onRate }: FeedbackButtonsProps) {
  const rating = msg.userRating

  return (
    <div className="flex items-center gap-0.5 px-3 pb-2">
      <button
        onClick={() => onRate(msg.id, rating === 5 ? 0 : 5)}
        className="no-style p-1 rounded transition-all hover:bg-[var(--color-border)]/40"
        title="Good response"
      >
        <ThumbsUp
          size={12}
          className={rating === 5 ? 'text-green-400' : 'text-[var(--color-text-muted)] opacity-40 hover:opacity-100'}
          fill={rating === 5 ? 'currentColor' : 'none'}
        />
      </button>
      <button
        onClick={() => onRate(msg.id, rating === 1 ? 0 : 1)}
        className="no-style p-1 rounded transition-all hover:bg-[var(--color-border)]/40"
        title="Bad response"
      >
        <ThumbsDown
          size={12}
          className={rating === 1 ? 'text-red-400' : 'text-[var(--color-text-muted)] opacity-40 hover:opacity-100'}
          fill={rating === 1 ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  )
}
