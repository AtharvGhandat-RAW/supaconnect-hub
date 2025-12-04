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
    <div className={cn('relative', sizes[size], className)}>
      {/* Outer ring with gradient */}
      <div
        className={cn(
          'absolute inset-0 rounded-full border-2 border-transparent animate-loader-spin',
          'bg-gradient-to-r from-primary-600 via-secondary-600 to-accent-electric'
        )}
        style={{
          backgroundClip: 'border-box',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {/* Gap in the ring */}
      <div
        className={cn(
          'absolute inset-0 rounded-full border-2 border-transparent',
          'border-t-transparent animate-loader-spin'
        )}
        style={{
          borderImage: 'linear-gradient(to right, #4F46E5, #9333EA, #22D3EE) 1',
          borderRadius: '50%',
        }}
      />
      <svg
        className={cn('animate-loader-spin', sizes[size])}
        viewBox="0 0 50 50"
      >
        <defs>
          <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#9333EA" />
            <stop offset="100%" stopColor="#22D3EE" />
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
