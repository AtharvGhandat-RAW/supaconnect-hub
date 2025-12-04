import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Orb {
  id: number;
  size: number;
  x: number;
  y: number;
  color: string;
  delay: number;
  duration: number;
}

interface FloatingOrbsProps {
  count?: number;
  colors?: string[];
  className?: string;
  opacity?: number;
}

const FloatingOrbs: React.FC<FloatingOrbsProps> = ({
  count = 5,
  colors = ['bg-primary-600', 'bg-secondary-600', 'bg-accent-electric'],
  className,
  opacity = 0.3,
}) => {
  const orbs: Orb[] = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 300 + 100,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: colors[i % colors.length],
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 15,
    }));
  }, [count, colors]);

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className={cn(
            'absolute rounded-full blur-3xl',
            orb.color
          )}
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            opacity,
          }}
          animate={{
            x: [0, 50, -30, 20, 0],
            y: [0, -40, 30, -20, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

export default FloatingOrbs;
