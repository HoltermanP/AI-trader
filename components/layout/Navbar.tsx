'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[#1E1E28] bg-navy px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-blue-light">AI</span>
            <span className="text-off-white">-Trader</span>
          </span>
          <span className="text-[10px] font-mono text-slate-custom hidden sm:block border border-[#1E1E28] px-1.5 py-0.5 rounded">
            by AI-Group.nl
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'bg-[#1E1E28] text-off-white'
                  : 'text-slate-custom hover:text-off-white hover:bg-[#1E1E28]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
