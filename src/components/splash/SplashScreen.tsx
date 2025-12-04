import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FloatingOrbs from '@/components/ui/FloatingOrbs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ritLogo from '@/assets/rit-logo.jpg';

const SplashScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transitionDuration = prefersReducedMotion ? 1 : 2.8;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        navigate('/login/faculty');
      }, 500);
    }, transitionDuration * 1000);

    return () => clearTimeout(timer);
  }, [navigate, transitionDuration]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-primary-900 via-secondary-700/50 to-black overflow-hidden"
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Floating orbs background */}
          <FloatingOrbs count={6} opacity={0.2} />

          {/* Content container */}
          <motion.div
            className="relative z-10 flex flex-col items-center text-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Logo with glow */}
            <motion.div
              className="relative mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: prefersReducedMotion ? 0.3 : 1.2, 
                ease: 'easeOut' 
              }}
            >
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <motion.div
                  className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-secondary-600/30 blur-3xl"
                  animate={prefersReducedMotion ? {} : {
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </div>

              {/* Logo image with micro-pulse */}
              <motion.img
                src={ritLogo}
                alt="RIT Polytechnic Logo"
                className="w-28 h-28 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-full object-cover shadow-2xl ring-4 ring-white/10"
                animate={prefersReducedMotion ? {} : {
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>

            {/* Institute name */}
            <motion.h1
              className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: prefersReducedMotion ? 0.1 : 0.4, 
                duration: prefersReducedMotion ? 0.2 : 0.6 
              }}
            >
              Rajarambapu Institute of Technology
            </motion.h1>

            {/* Department */}
            <motion.p
              className="font-sans text-base md:text-lg lg:text-xl text-muted-foreground mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: prefersReducedMotion ? 0.15 : 0.6, 
                duration: prefersReducedMotion ? 0.2 : 0.6 
              }}
            >
              Polytechnic • AIML Department
            </motion.p>

            {/* Loading spinner */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ 
                delay: prefersReducedMotion ? 0.2 : 0.8, 
                duration: 0.4 
              }}
            >
              <LoadingSpinner size="lg" />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
