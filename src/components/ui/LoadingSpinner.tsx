import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
}) => {
  return (
    <div className={cn('relative', sizes[size], className)} style={{ filter: 'drop-shadow(0 0 8px rgba(37, 211, 102, 0.3))' }}>
      <svg
        className={cn('animate-loader-spin', sizes[size])}
        viewBox="0 0 50 50"
      >
        <defs>
          <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(168, 76%, 26%)" />
            <stop offset="50%" stopColor="hsl(168, 53%, 31%)" />
            <stop offset="100%" stopColor="hsl(142, 70%, 49%)" />
          </linearGradient>
        </defs>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="url(#spinner-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="80, 200"
          strokeDashoffset="0"
        />
      </svg>
    </div>
  );
};

export default LoadingSpinner;
