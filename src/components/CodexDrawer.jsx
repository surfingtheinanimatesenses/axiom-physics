import React, { useState, useMemo } from 'react';
import {
  CODEX_CATEGORIES,
  CODEX_ABILITIES,
} from '../engine/codexAbilities.js';
import {
  Search,
  X,
  Play,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
} from 'lucide-react';

export default function CodexDrawer({
  isOpen,
  onClose,
  onExecuteRules,
  onLoadPrompt,
}) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Filter abilities by category and search text
  const filteredAbilities = useMemo(() => {
    return CODEX_ABILITIES.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ALL' || item.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.prompt.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, searchQuery]);

  const handleCopyPrompt = (id, promptText) => {
    navigator.clipboard.writeText(promptText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-[440px] max-w-[92vw] bg-zinc-950/95 backdrop-blur-2xl border-r border-white/10 z-40 flex flex-col font-mono text-xs transition-transform duration-300 ease-in-out shadow-[0_0_40px_rgba(0,0,0,0.8)] ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-label="Physical Abilities Codex"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <h2 className="text-xs font-semibold text-zinc-100 tracking-wider uppercase">
            CODEX // 20 PHYSICAL PHENOMENA
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 text-[9px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold tracking-widest uppercase">
            {filteredAbilities.length} ACTIVE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 cursor-pointer p-0.5 transition-colors"
            title="Close Codex (Escape)"
            aria-label="Close Codex"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-2.5 border-b border-white/5 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-950 border border-white/10 focus-within:border-emerald-500/60 transition-colors">
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phenomena, forces, keywords..."
            className="flex-1 bg-transparent border-none text-zinc-200 placeholder:text-zinc-600 text-xs font-mono focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-zinc-950/70 overflow-x-auto scrollbar-none shrink-0">
        {CODEX_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-1 text-[10px] font-mono tracking-wider whitespace-nowrap uppercase border transition-colors cursor-pointer shrink-0 ${
              selectedCategory === cat.id
                ? 'bg-zinc-800 border-emerald-500/60 text-emerald-300 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-900/80 border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
            }`}
          >
            {cat.label} ({cat.count})
          </button>
        ))}
      </div>

      {/* Scrollable Ability Cards List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-[#09090b]">
        {filteredAbilities.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 font-mono text-xs">
            NO MATCHING PHENOMENA FOUND.
            <div className="text-[10px] text-zinc-700 mt-1">
              Try searching "orbit", "oil", "explode", "black hole", or "quantum".
            </div>
          </div>
        ) : (
          filteredAbilities.map((item, idx) => (
            <div
              key={item.id}
              className="p-3 bg-zinc-950/80 hover:bg-zinc-900/90 border border-white/10 hover:border-white/20 transition-all group flex flex-col gap-2"
            >
              {/* Card Header: Category & Number */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 border border-white/10 text-emerald-400 font-bold uppercase tracking-widest">
                  {item.categoryLabel}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                  #{String(idx + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-100 tracking-wider">
                  {item.title}
                </h3>
                <div className="text-[10px] text-zinc-400 font-medium">
                  {item.subtitle}
                </div>
              </div>

              {/* Plain English Scientific Summary */}
              <p className="text-[11px] text-zinc-300 leading-relaxed font-sans font-light">
                {item.description}
              </p>

              {/* Natural Language Prompt Preview */}
              <div className="p-2 bg-zinc-900/90 border border-white/5 text-[10px] font-mono text-cyan-300 break-words flex items-start justify-between gap-2">
                <span className="select-all">&gt; "{item.prompt}"</span>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(item.id, item.prompt)}
                  className="text-zinc-500 hover:text-zinc-200 cursor-pointer p-0.5 shrink-0"
                  title="Copy Prompt Text"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Parameter Tags */}
              <div className="flex flex-wrap items-center gap-1">
                {item.tags.map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-white/5 text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Action Buttons: EXECUTE (0ms) + TWEAK IN PROMPT */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => onExecuteRules(item)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 text-[10px] font-mono font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                  title="Apply pre-compiled physical law immediately with 0ms latency"
                >
                  <Play className="w-2.5 h-2.5 text-emerald-400" />
                  <span>EXECUTE (0ms)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoadPrompt(item.prompt)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-300 text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer"
                  title="Paste into bottom dock command input to edit and tweak"
                >
                  <span>TWEAK PROMPT</span>
                  <ArrowRight className="w-2.5 h-2.5 text-zinc-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Instructions */}
      <div className="p-2.5 border-t border-white/10 text-[10px] text-zinc-500 flex items-center justify-between bg-zinc-950 shrink-0">
        <span>TIP: CLICK EXECUTE FOR 0MS LOCAL RUN</span>
        <span className="text-emerald-400">AXIOM // 2D CODEX</span>
      </div>
    </aside>
  );
}
