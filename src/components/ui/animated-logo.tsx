import React from 'react';

interface AnimatedLogoProps {
  size?: number;
  className?: string;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ 
  size = 100, 
  className = "" 
}) => {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* CSS Animations */}
        <defs>
          <style>
            {`
              .leaf {
                animation: leafPulse 2s ease-in-out infinite;
                transform-origin: 100px 100px;
              }
              
              .leaf-1 {
                animation-delay: 0s;
              }
              
              .leaf-2 {
                animation-delay: 0.33s;
              }
              
              .leaf-3 {
                animation-delay: 0.66s;
              }
              
              @keyframes leafPulse {
                0% {
                  transform: scale(1) translate(0, 0);
                  opacity: 1;
                }
                50% {
                  transform: scale(0.3) translate(0, 0);
                  opacity: 0.7;
                }
                100% {
                  transform: scale(1) translate(0, 0);
                  opacity: 1;
                }
              }
              
              .center-circle {
                animation: centerPulse 2s ease-in-out infinite;
              }
              
              @keyframes centerPulse {
                0%, 100% {
                  transform: scale(1);
                  opacity: 1;
                }
                50% {
                  transform: scale(1.2);
                  opacity: 0.8;
                }
              }
              
              .book {
                animation: bookFloat 3s ease-in-out infinite;
              }
              
              @keyframes bookFloat {
                0%, 100% {
                  transform: translateY(0);
                }
                50% {
                  transform: translateY(-2px);
                }
              }
            `}
          </style>
        </defs>

        {/* Open Book at bottom */}
        <g className="book">
          {/* Left page */}
          <path
            d="M 40 140 Q 100 130 100 140 L 100 170 Q 100 175 95 175 L 45 175 Q 40 175 40 170 Z"
            fill="currentColor"
            opacity="0.9"
          />
          {/* Right page */}
          <path
            d="M 100 140 Q 160 130 160 140 L 160 170 Q 160 175 155 175 L 105 175 Q 100 175 100 170 Z"
            fill="currentColor"
            opacity="0.9"
          />
          {/* Book spine/binding */}
          <rect x="98" y="140" width="4" height="35" fill="currentColor" />
        </g>

        {/* Center Circle */}
        <circle
          cx="100"
          cy="100"
          r="8"
          fill="currentColor"
          className="center-circle"
        />

        {/* Top Leaf */}
        <g className="leaf leaf-1">
          <path
            d="M 100 60 Q 90 45 100 30 Q 110 45 100 60"
            fill="currentColor"
          />
        </g>

        {/* Left Leaf */}
        <g className="leaf leaf-2">
          <path
            d="M 60 100 Q 45 90 30 100 Q 45 110 60 100"
            fill="currentColor"
          />
        </g>

        {/* Right Leaf */}
        <g className="leaf leaf-3">
          <path
            d="M 140 100 Q 155 90 170 100 Q 155 110 140 100"
            fill="currentColor"
          />
        </g>
      </svg>
    </div>
  );
};

export default AnimatedLogo;