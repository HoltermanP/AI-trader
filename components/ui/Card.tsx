import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export default function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-surface border border-[#1E1E28] rounded-[12px] p-5 sm:p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}
