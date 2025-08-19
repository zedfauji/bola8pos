interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = "", size = "md", showText = true }: LogoProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16", 
    lg: "w-24 h-24",
    xl: "w-32 h-32"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-4xl"
  };

  return (
    <div className={`flex items-center ${className}`}>
      {/* Logo SVG - 8-ball with pool cue */}
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pool cue in background */}
          <line
            x1="10"
            y1="90"
            x2="60"
            y2="40"
            stroke="url(#cueGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* 8-ball */}
          <circle cx="50" cy="50" r="25" fill="url(#ballGradient)" />
          
          {/* White circle for number */}
          <circle cx="50" cy="50" r="12" fill="white" />
          
          {/* Number 8 */}
          <text
            x="50"
            y="58"
            textAnchor="middle"
            className="fill-rock-black font-bold text-xl"
            style={{ fontSize: '18px' }}
          >
            8
          </text>
          
          {/* Highlight on ball */}
          <ellipse cx="42" cy="40" rx="6" ry="8" fill="rgba(255,255,255,0.3)" />
          
          {/* Gradients */}
          <defs>
            <radialGradient id="ballGradient" cx="0.3" cy="0.3">
              <stop offset="0%" stopColor="#2a2a2a" />
              <stop offset="70%" stopColor="#000000" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
            <linearGradient id="cueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B4513" />
              <stop offset="50%" stopColor="#D2691E" />
              <stop offset="100%" stopColor="#CD853F" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Text */}
      {showText && (
        <div className="ml-3">
          <div className={`font-rock ${textSizes[size]} text-rock-gold tracking-wider`}>
            BOLA 8
          </div>
          <div className={`font-elegant text-chrome ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-lg'}`}>
            Pool Club La Calma
          </div>
        </div>
      )}
    </div>
  );
}