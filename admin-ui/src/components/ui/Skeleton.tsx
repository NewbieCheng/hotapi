import './Skeleton.css'

interface SkeletonProps {
  className?: string
  height?: number | string
  width?: number | string
}

export function Skeleton({ className = '', height = 16, width = '100%' }: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton ${className}`.trim()}
      style={{ height, width }}
      aria-hidden
    />
  )
}

export function StatsSkeleton() {
  return (
    <div className="stats-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="stats-skeleton__card">
          <Skeleton height={12} width="60%" />
          <Skeleton height={28} width="40%" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="list-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="list-skeleton__row">
          <Skeleton height={14} width="70%" />
          <Skeleton height={12} width="45%" />
        </div>
      ))}
    </div>
  )
}
