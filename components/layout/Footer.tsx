export default function Footer() {
  return (
    <footer className="border-t border-[#1E1E28] bg-navy px-4 py-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs font-mono text-slate-custom">
          <span className="text-blue-light">AI</span>-Group.nl &middot; AI-Trader
        </span>
        <span className="text-xs font-mono text-slate-custom tracking-[0.2em] uppercase">
          AI-FIRST &middot; WE SHIP FAST
        </span>
        <span className="text-xs text-slate-custom font-mono">
          &copy; {new Date().getFullYear()} AI-Group.nl
        </span>
      </div>
    </footer>
  );
}
