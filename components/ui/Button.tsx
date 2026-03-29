import { type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'cta' | 'outline';
}

export default function Button({ children, variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'px-4 py-2.5 rounded-lg font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-deep-black disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-ai-blue text-white hover:bg-[#3D7FF8] focus:ring-ai-blue',
        variant === 'cta' && 'bg-velocity-red text-white hover:bg-[#FF6040] focus:ring-velocity-red',
        variant === 'outline' && 'bg-transparent border border-white/20 text-off-white hover:border-white/40 focus:ring-white/20',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
