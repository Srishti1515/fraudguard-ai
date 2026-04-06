import clsx from 'clsx'

interface RiskMeterProps {
  score: number   // 0–100
  size?: 'sm' | 'md' | 'lg'
}

export default function RiskMeter({ score, size = 'md' }: RiskMeterProps) {
  const level = score < 30 ? 'low' : score < 70 ? 'medium' : 'high'
  const color  = level === 'low' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#ef4444'
  const label  = level === 'low' ? 'Low Risk' : level === 'medium' ? 'Medium Risk' : 'High Risk'

  const dim = size === 'sm' ? 80 : size === 'lg' ? 160 : 120
  const r   = (dim / 2) - 10
  const circumference = Math.PI * r   // semi-circle
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim / 2 + 20 }}>
        <svg width={dim} height={dim / 2 + 20} viewBox={`0 0 ${dim} ${dim / 2 + 20}`}>
          {/* Track */}
          <path
            d={`M ${10} ${dim / 2} A ${r} ${r} 0 0 1 ${dim - 10} ${dim / 2}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth={size === 'sm' ? 6 : 10}
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={`M ${10} ${dim / 2} A ${r} ${r} 0 0 1 ${dim - 10} ${dim / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={size === 'sm' ? 6 : 10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
          {/* Score text */}
          <text
            x={dim / 2}
            y={dim / 2 - 2}
            textAnchor="middle"
            fontSize={size === 'sm' ? 14 : size === 'lg' ? 28 : 22}
            fontWeight="700"
            fill={color}
            fontFamily="Inter, sans-serif"
          >
            {Math.round(score)}%
          </text>
        </svg>
      </div>
      <div className={clsx(
        'px-3 py-1 rounded-full text-xs font-semibold border',
        level === 'low'    && 'risk-low',
        level === 'medium' && 'risk-medium',
        level === 'high'   && 'risk-high',
      )}>
        {label}
      </div>
    </div>
  )
}
