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
  primary: 'from-primary/40 via-accent/30 to-primary/40',
  secondary: 'from-secondary/40 via-primary/30 to-secondary/40',
  accent: 'from-accent/40 via-primary/30 to-accent/40',
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
          'absolute -inset-[1px] rounded-lg bg-gradient-to-r opacity-50 blur-sm transition-opacity duration-300',
          glowColors[glowColor],
          animate && 'group-hover:opacity-70'
        )}
      />
      {/* Main panel */}
      <div className="relative glass-card p-8 rounded-lg">
        {children}
      </div>
    </motion.div>
  );
};

export default GlowPanel;
