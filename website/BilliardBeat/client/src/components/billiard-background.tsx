interface BilliardBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export default function BilliardBackground({ children, className = "" }: BilliardBackgroundProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Subtle billiard ball pattern background */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%" className="w-full h-full">
          <defs>
            <pattern id="billiardPattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="8" fill="currentColor" opacity="0.3" />
              <circle cx="60" cy="60" r="8" fill="currentColor" opacity="0.2" />
              <circle cx="100" cy="20" r="8" fill="currentColor" opacity="0.25" />
              <circle cx="20" cy="100" r="8" fill="currentColor" opacity="0.15" />
              <circle cx="100" cy="100" r="8" fill="currentColor" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#billiardPattern)" />
        </svg>
      </div>
      
      {children}
    </div>
  );
}