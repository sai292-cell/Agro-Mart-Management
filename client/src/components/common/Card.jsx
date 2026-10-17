import React from 'react';

/**
 * Reusable Card component with clean border, neutral background, and subtle shadow
 */
export default function Card({
  children,
  className = '',
  hoverEffect = false,
  highlight = false,
  ...props
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 ${
        hoverEffect ? 'transition-all duration-200 hover:shadow-md hover:border-slate-300' : ''
      } ${highlight ? 'ring-1 ring-emerald-500/20 border-emerald-300' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
