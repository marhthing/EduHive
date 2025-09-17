import React from 'react';
import { AnimatedLogo } from './ui/animated-logo';

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 80, 
  text = "Loading...",
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
      <AnimatedLogo size={size} className="text-primary" />
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;