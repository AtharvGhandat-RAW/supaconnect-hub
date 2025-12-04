import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowPanelProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'primary' | 'secondary' | 'accent';
  animate?: boolean;
}

const glowColors = {
  primary: 'from-primary-600/50 via-secondary-600/50 to-primary-600/50',
  secondary: 'from-secondary-600/50 via-primary-600/50 to-secondary-600/50',
  accent: 'from-accent-electric/50 via-primary-600/50 to-accent-electric/50',
};

const GlowPanel: React.FC<GlowPanelProps> = ({
  children,
  className,
  glowColor = 'primary',
  animate = true,
}) => {
  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Glow effect */}
      <div
        className={cn(
          'absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-60 blur-sm transition-opacity duration-300',
          glowColors[glowColor],
          animate && 'group-hover:opacity-80'
        )}
      />
      {/* Main panel */}
      <div className="relative glass-card p-8 rounded-2xl">
        {children}
      </div>
    </motion.div>
  );
};

export default GlowPanel;
