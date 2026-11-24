import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPhysicsWorld } from './engine/physicsWorld.js';
import { INTERSTELLAR_PRESETS, BASELINE_PRESETS } from './engine/ruleEngine.js';
import { soundEngine } from './engine/soundEngine.js';
import {
  getStoredApiKey,
  setStoredApiKey,
  hasConfiguredApiKey,
  compilePromptWithGroq,
  GROQ_MODELS,
} from './engine/llmCompiler.js';
import {
  Terminal,
  RotateCcw,
  Plus,
  Cpu,
  X,
  Trash2,
  Key,
  Code,
  Copy,
  Check,
  Volume2,
  VolumeX,
  AlertTriangle,
  Play,
  Pause,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function App() {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);

  const [telemetry, setTelemetry] = useState({
    bodyCount: 24,
    maxBodies: 120,
    gravityX: 0.0,
    gravityY: 0.8,
    medium: 'air',
    viscosity: 0.85,
    fps: 60,
    isPaused: false,
  });

  const [activeRules, setActiveRules] = useState([]);
  const [commandText, setCommandText] = useState('');
  const [activeLawStatus, setActiveLawStatus] = useState('SYS_READY // IDLE');
  const [isCompiling, setIsCompiling] = useState(false);
  const [stackMode, setStackMode] = useState('APPEND'); // 'APPEND' | 'REPLACE'
  const [activeModel, setActiveModel] = useState(GROQ_MODELS.primary);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Inspector & Key Popover State
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isKeyPopoverOpen, setIsKeyPopoverOpen] = useState(false);
  const [isKeyConfigured, setIsKeyConfigured] = useState(() => hasConfiguredApiKey());
  const [keyInput, setKeyInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Non-blocking toast state
  const [errorToast, setErrorToast] = useState({ visible: false, message: '', isSecurity: false });

  useEffect(() => {
    if (!canvasRef.current) return;

    const world = createPhysicsWorld(canvasRef.current, {
      onTelemetry: (data) => {
        setTelemetry((prev) => ({ ...prev, ...data }));
      },
      onRulesChanged: (rules) => {
        setActiveRules(rules);
      },
    });

    worldRef.current = world;

    return () => {
      world.destroy();
      worldRef.current = null;
    };
  }, []);

  const handleSpawnBatch = useCallback(() => {
    if (worldRef.current) {
      worldRef.current.spawnBatch(15);
      const bodies = worldRef.current.getDynamicBodies();
      setTelemetry((prev) => ({
        ...prev,
        bodyCount: bodies.length,
      }));
    }
  }, []);

  const handleReset = useCallback(() => {
    if (worldRef.current) {
      worldRef.current.resetWorld();
      setTelemetry((prev) => ({
        ...prev,
        bodyCount: 24,
        gravityX: 0.0,
        gravityY: 0.8,
        medium: 'air',
        viscosity: 0.85,
      }));
      setActiveRules([]);
      setActiveLawStatus('SYS_RESET // BASELINE');
    }
  }, []);

  const handleToggleMedium = useCallback(() => {
    if (worldRef.current) {
      const nextMedium = telemetry.medium === 'oil' ? 'air' : 'oil';
      worldRef.current.setMedium(nextMedium, telemetry.viscosity);
      setActiveLawStatus(nextMedium === 'oil' ? 'MEDIUM_SWITCH // CASTROL OIL' : 'MEDIUM_SWITCH // AIR');
    }
  }, [telemetry.medium, telemetry.viscosity]);

  const handleViscosityChange = useCallback((newVisc) => {
    if (worldRef.current) {
      worldRef.current.setMedium('oil', newVisc);
    }
  }, []);

  const handleRemoveRule = useCallback((ruleId) => {
    if (worldRef.current) {
      const updated = worldRef.current.removeRule(ruleId);
      setActiveRules(updated);
      setActiveLawStatus(`RULE_REVERTED // REMAINING: ${updated.length}`);
    }
  }, []);

  const handleClearAll = useCallback(() => {
    if (worldRef.current) {
      const updated = worldRef.current.clearAllRules();
      setActiveRules(updated);
      setActiveLawStatus('RULES_PURGED // BASELINE_RESTORED');
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (worldRef.current) {
      const paused = worldRef.current.togglePause();
      setActiveLawStatus(paused ? 'SYS_PAUSED // SPACE TO RESUME' : 'SYS_RUNNING // 60FPS');
    }
  }, []);

  // Keyboard Shortcuts (Space: pause/resume, C: clear rules, R: reset bodies, Esc: close popovers)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsInspectorOpen(false);
        setIsKeyPopoverOpen(false);
        return;
      }

      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
        return; // Disabled while typing
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePause, handleClearAll, handleReset]);

  // Offline Presets
  const applyPreset = useCallback(
    (preset) => {
      if (!worldRef.current) return;

      setCommandText(preset.description);
      setActiveLawStatus(`LOADING // ${preset.pillLabel}...`);

      if (stackMode === 'REPLACE') {
        worldRef.current.clearAllRules();
      }

      const updated = worldRef.current.addRule(preset.rules);
      setActiveRules(updated);

      if (preset.postAction) {
        preset.postAction(worldRef.current);
      }

      setActiveLawStatus(`ACTIVE // ${preset.pillLabel}`);
    },
    [stackMode]
  );

  // Key Saving (masked, never displayed in plain text)
  const handleSaveKey = useCallback((val) => {
    const k = val.trim();
    if (k && !k.startsWith('gsk_')) {
      setErrorToast({
        visible: true,
        message: 'INVALID KEY FORMAT — MUST START WITH gsk_',
        isSecurity: false,
      });
      setTimeout(() => setErrorToast((prev) => ({ ...prev, visible: false })), 4000);
      return;
    }

    setStoredApiKey(k);
    setIsKeyConfigured(hasConfiguredApiKey());
    setKeyInput('');
    setIsKeyPopoverOpen(false);
    setActiveLawStatus(k ? 'KEY_STORED // ENCRYPTED' : 'KEY_PURGED // UNSET');
  }, []);

  // Sound Toggle
  const handleToggleSound = useCallback(() => {
    const next = soundEngine.toggleEnabled();
    setSoundEnabled(next);
  }, []);

  // Compile Handler with Strict Guardrail Trapping
  const handleCompile = useCallback(
    async (overrideText) => {
      const input = (overrideText !== undefined ? overrideText : commandText).trim();
      if (!input || !worldRef.current) return;

      // 1. Direct JSON input
      if (input.startsWith('{') || input.startsWith('[')) {
        try {
          const parsed = JSON.parse(input);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          if (stackMode === 'REPLACE') {
            worldRef.current.clearAllRules();
          }
          const updated = worldRef.current.addRule(list);
          setActiveRules(updated);
          setActiveLawStatus(`COMPILED // ${list.length} JSON RULE(S)`);
          return;
        } catch {
          setActiveLawStatus('ERR // INVALID_JSON');
          setErrorToast({
            visible: true,
            message: 'INVALID JSON SYNTAX — USE PRESETS',
            isSecurity: false,
          });
          setTimeout(() => setErrorToast((prev) => ({ ...prev, visible: false })), 4000);
          return;
        }
      }

      // 2. Groq LLM Compilation with Multi-Tier Guardrails (Direct Key or Secure Serverless Gateway)
      const currentKey = getStoredApiKey();

      setIsCompiling(true);
      setActiveLawStatus('GUARDRAIL_SCAN // ANALYZING...');

      try {
        const result = await compilePromptWithGroq(input, currentKey);
        setActiveModel(result.modelUsed);

        if (stackMode === 'REPLACE') {
          worldRef.current.clearAllRules();
        }

        const updated = worldRef.current.addRule(result.rules);
        setActiveRules(updated);
        setActiveLawStatus(`COMPILED // ${result.summary}`);
      } catch (err) {
        console.warn('Compilation error:', err.message);

        let toastMsg = 'API TIMEOUT — USE PRESETS';
        let isSec = false;

        if (err.message?.includes('GUARDRAIL_REJECTED')) {
          toastMsg = 'GUARDRAIL BLOCKED: PROMPT INJECTION DETECTED';
          isSec = true;
          setActiveLawStatus('SECURITY_INTERCEPT // INJECTION_DETECTED');
        } else if (err.message?.includes('UNMAPPED_LAW')) {
          toastMsg = 'COULD NOT MAP LAW — SPECIFY FORCES, BOUNCE, OR COLLISION';
          setActiveLawStatus('ERR // UNMAPPED_PHYSICS_LAW');
        } else if (err.message?.includes('429') || err.message?.includes('rate')) {
          toastMsg = 'API RATE LIMIT EXCEEDED — USE PRESETS';
          setActiveLawStatus('RATE_LIMIT_TRIPPED // USE_PRESETS');
        } else if (err.message?.includes('401') || err.message?.includes('NO_API_KEY')) {
          toastMsg = 'AUTHENTICATION FAILED — CHECK GROQ KEY';
          setActiveLawStatus('AUTH_FAILED // CHECK_KEY');
          setIsKeyPopoverOpen(true);
        } else {
          setActiveLawStatus('ERR // COMPILER_FALLBACK');
        }

        setErrorToast({
          visible: true,
          message: toastMsg,
          isSecurity: isSec,
        });
        setTimeout(() => setErrorToast((prev) => ({ ...prev, visible: false })), 4500);
      } finally {
        setIsCompiling(false);
      }
    },
    [commandText, stackMode]
  );

  // Syntax highlighting for JSON Inspector
  const jsonOutput = useMemo(() => {
    const payload = {
      model: activeModel,
      stackMode,
      activeCount: activeRules.length,
      rules: activeRules.map((r) => r.raw || r),
    };
    return JSON.stringify(payload, null, 2);
  }, [activeRules, activeModel, stackMode]);

  const syntaxHighlightedJson = useMemo(() => {
    if (!jsonOutput) return '';
    return jsonOutput
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = 'text-amber-300';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'text-cyan-400 font-semibold';
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-emerald-400';
          } else if (/null/.test(match)) {
            cls = 'text-zinc-500';
          } else {
            cls = 'text-emerald-300';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
  }, [jsonOutput]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonOutput);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1500);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#09090b] font-mono">
      {/* Precision HTML5 Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-crosshair touch-none"
      />

      {/* Crosshair Viewport Framing Markers */}
      <div className="pointer-events-none absolute top-3 left-3 text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
        AXM-VPORT // 100VW x 100VH
      </div>
      <div className="pointer-events-none absolute top-3 right-3 text-[10px] text-zinc-600 font-mono tracking-widest">
        RES: {window.innerWidth}x{window.innerHeight} @ {window.devicePixelRatio || 1}X
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-zinc-600 font-mono tracking-widest flex items-center gap-2">
        <span>ENGINE: MATTER-JS // GROQ // OSS-120B</span>
        <span className="text-zinc-500 hidden md:inline">[SPACE: PAUSE] [C: CLEAR] [R: RESET]</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-zinc-600 font-mono tracking-widest">
        STATUS: {activeLawStatus}
      </div>

      {/* Top-Left Active Rules Stack */}
      <aside className="absolute top-9 left-3 z-20 flex flex-col gap-1.5 w-72 max-w-[calc(100vw-1.5rem)] pointer-events-auto">
        {activeRules.length > 0 && (
          <div className="flex items-center justify-between px-1.5 py-0.5 bg-zinc-950/80 border border-white/5 backdrop-blur-sm text-[10px] text-zinc-500 font-mono">
            <span>ACTIVE RULES ({activeRules.length})</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 text-[9px] text-zinc-400 hover:text-red-400 uppercase tracking-wider cursor-pointer transition-colors"
              title="Clear all active rules and revert to baseline (Shortcut: C)"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>CLEAR ALL [C]</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto pr-1">
          {activeRules.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 px-2 py-1 bg-zinc-950/85 hover:bg-zinc-900/90 border border-white/10 text-[10px] font-mono text-zinc-300 backdrop-blur-md transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[9px] px-1 py-0.2 bg-zinc-900 border border-white/10 text-emerald-400 font-semibold shrink-0">
                  {r.type.toUpperCase()}
                </span>
                <span className="truncate text-zinc-200" title={r.label}>
                  {r.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRule(r.id)}
                className="text-zinc-500 hover:text-red-400 hover:bg-white/5 p-0.5 transition-colors cursor-pointer shrink-0"
                title="Remove rule & revert baseline"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Top Floating Strip: CAD HUD */}
      <header className="fixed top-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-zinc-950/80 backdrop-blur-md border border-white/10 text-xs text-zinc-300">
          {/* Title & Diagnostic LED */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <h1 className="text-xs font-semibold tracking-widest text-zinc-100 uppercase">
              AXIOM // 2D
            </h1>
            <span className="text-zinc-600 hidden sm:inline">|</span>
            <span className="text-[11px] text-zinc-400 tracking-wider hidden sm:inline">
              PRECISION RIGID-BODY CORE
            </span>
          </div>

          {/* Telemetry Readouts */}
          <div className="flex items-center gap-2 sm:gap-3 tabular-nums text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-white/5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">BODIES</span>
              <span className="text-zinc-100 font-medium">
                {telemetry.bodyCount}/{telemetry.maxBodies}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-white/5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">GRAVITY</span>
              <span className="text-zinc-100 font-medium">
                {telemetry.gravityX.toFixed(1)}, {telemetry.gravityY.toFixed(1)}
              </span>
            </div>

            {/* Medium Indicator & Toggle */}
            <button
              type="button"
              onClick={handleToggleMedium}
              className={`flex items-center gap-1.5 px-2 py-0.5 border text-xs font-mono transition-all cursor-pointer ${
                telemetry.medium === 'oil'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'bg-zinc-900 border-white/10 text-zinc-300 hover:border-white/20'
              }`}
              title="Toggle Medium (Air vs Viscous Motor Oil)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${telemetry.medium === 'oil' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-500'}`} />
              <span className="text-[10px] uppercase font-bold tracking-wider">
                {telemetry.medium === 'oil' ? 'MEDIUM: OIL' : 'MEDIUM: AIR'}
              </span>
            </button>

            {/* Compact Viscosity Slider (Visible in Oil Mode) */}
            {telemetry.medium === 'oil' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                <span className="text-zinc-500 uppercase tracking-wider hidden sm:inline">VISCOSITY</span>
                <span className="tabular-nums font-bold">η:{Math.round(telemetry.viscosity * 100)}%</span>
                <input
                  type="range"
                  min="0.10"
                  max="1.00"
                  step="0.05"
                  value={telemetry.viscosity}
                  onChange={(e) => handleViscosityChange(parseFloat(e.target.value))}
                  className="w-14 sm:w-16 h-1 bg-zinc-800 accent-amber-400 cursor-pointer"
                  title="Fluid Viscosity Factor (10% - 100%)"
                />
              </div>
            )}

            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-white/5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">FPS</span>
              <span className="text-emerald-400 font-medium">{telemetry.fps}</span>
            </div>

            {telemetry.isPaused && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-950/80 border border-amber-500/50 text-amber-300 font-semibold animate-pulse text-[10px]">
                <Pause className="w-2.5 h-2.5" />
                <span>PAUSED</span>
              </div>
            )}
          </div>

          {/* Controls: SOUND, KEY (hidden text), JSON Toggle, +15 SPAWN, RESET */}
          <div className="flex items-center gap-1.5">
            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-mono tracking-wider border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-zinc-900 border-white/15 text-zinc-200 hover:border-white/30'
                  : 'bg-zinc-950 border-white/5 text-zinc-600 hover:border-white/20'
              }`}
              title="Toggle Procedural Web Audio Synth"
            >
              {soundEnabled ? (
                <Volume2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <VolumeX className="w-3 h-3 text-zinc-500" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'SOUND ON' : 'SOUND OFF'}</span>
            </button>

            {/* Pause/Resume button */}
            <button
              type="button"
              onClick={handleTogglePause}
              className="flex items-center gap-1 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 hover:border-white/30 text-xs font-mono tracking-wider active:translate-y-px transition-all cursor-pointer"
              title="Pause/Resume simulation (Space)"
            >
              {telemetry.isPaused ? (
                <Play className="w-3 h-3 text-emerald-400" />
              ) : (
                <Pause className="w-3 h-3 text-zinc-400" />
              )}
              <span className="hidden md:inline">{telemetry.isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>

            {/* API Key Modal Button — Masked Status Only, No Raw Keys Exposed */}
            <button
              type="button"
              onClick={() => setIsKeyPopoverOpen(!isKeyPopoverOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs font-mono tracking-wider border transition-all cursor-pointer ${
                isKeyConfigured
                  ? 'bg-zinc-900 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-300 hover:border-amber-400'
              }`}
              title="Configure Groq API Key (Securely Masked)"
            >
              {isKeyConfigured ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Key className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>KEY</span>
              <span className="text-[9px] px-1 py-0.2 bg-zinc-950 border border-white/10 uppercase">
                {isKeyConfigured ? 'CONFIGURED' : 'UNSET'}
              </span>
            </button>

            {/* JSON Inspector Toggle Button */}
            <button
              type="button"
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-mono tracking-wider border transition-all cursor-pointer ${
                isInspectorOpen
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/15'
              }`}
              title="Toggle Live JSON Inspector Drawer"
            >
              <Code className="w-3 h-3 text-cyan-400" />
              <span>&#123; &#125; JSON</span>
            </button>

            <button
              type="button"
              onClick={handleSpawnBatch}
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 hover:border-white/30 text-xs font-mono tracking-wider active:translate-y-px transition-all cursor-pointer"
              title="Spawn 15 randomized dynamic bodies"
            >
              <Plus className="w-3 h-3 text-zinc-400" />
              <span>+15</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 border border-white/15 hover:border-red-500/40 text-xs font-mono tracking-wider active:translate-y-px transition-all cursor-pointer"
              title="Reset world to baseline (Shortcut: R)"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>RESET</span>
            </button>
          </div>
        </div>
      </header>

      {/* Groq API Key Inline Popover — Hidden, Masked, No Raw Keys in Viewport */}
      {isKeyPopoverOpen && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          <div className="bg-zinc-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl p-4 flex flex-col gap-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold tracking-wider uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>API CREDENTIAL VAULT</span>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyPopoverOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Security Status Box */}
            <div className={`p-2.5 border text-xs flex items-center justify-between ${
              isKeyConfigured
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {isKeyConfigured ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-semibold">
                  {isKeyConfigured ? 'KEY ACTIVE & STORED LOCALLY' : 'NO KEY CONFIGURED'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {isKeyConfigured ? 'RESTRICTED' : 'REQUIRED'}
              </span>
            </div>

            <div className="text-[11px] text-zinc-400 leading-relaxed">
              API keys are stored directly in your browser's private <code className="text-zinc-200">localStorage</code>. They are strictly masked and never rendered in plain text on the viewport.
            </div>

            {/* Secure Masked Password Input */}
            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest">
                ENTER OR UPDATE API KEY:
              </span>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="gsk_••••••••••••••••••••••••"
                    className="w-full bg-zinc-900 border border-white/15 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    title={showKeyText ? 'Mask key' : 'Show key'}
                  >
                    {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveKey(keyInput)}
                  className="px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase cursor-pointer transition-colors"
                >
                  SAVE
                </button>

                {isKeyConfigured && (
                  <button
                    type="button"
                    onClick={() => handleSaveKey('')}
                    className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs cursor-pointer transition-colors"
                    title="Remove stored key"
                  >
                    PURGE
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live JSON Inspector Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-84 max-w-[85vw] bg-zinc-950/90 backdrop-blur-xl border-l border-white/10 z-30 flex flex-col font-mono text-xs transition-transform duration-300 ease-in-out shadow-2xl ${
          isInspectorOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-zinc-950">
          <div className="flex items-center gap-2">
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-zinc-200 tracking-wider">
              JSON INSPECTOR // AST
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 text-[9px] bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold tracking-widest uppercase">
              {activeModel === GROQ_MODELS.primary ? 'OSS-120B' : 'OSS-20B'}
            </span>
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              className="text-zinc-500 hover:text-zinc-200 cursor-pointer p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Sub-bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-white/5 text-[10px] text-zinc-400">
          <div className="flex items-center gap-2">
            <span>RULES: <strong className="text-zinc-200">{activeRules.length}</strong></span>
            <span>|</span>
            <span>STACK: <strong className="text-cyan-400">{stackMode}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleCopyJson}
            className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-colors cursor-pointer"
          >
            {copiedJson ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
            <span>{copiedJson ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-3 overflow-y-auto text-[11px] leading-relaxed bg-[#0c0c0e]">
          <pre
            className="font-mono whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: syntaxHighlightedJson }}
          />
        </div>

        {/* Drawer Footer */}
        <div className="p-2 border-t border-white/10 text-[10px] text-zinc-500 flex items-center justify-between bg-zinc-950">
          <span>SCHEMA: V2 DETERMINISTIC</span>
          <span className="text-emerald-400">GROQ DIRECT 60FPS</span>
        </div>
      </aside>

      {/* Non-Blocking Error & Guardrail Toast */}
      {errorToast.visible && (
        <aside
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-20 right-4 z-50 max-w-sm border p-3 font-mono text-xs backdrop-blur-xl flex items-start gap-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            errorToast.isSecurity
              ? 'bg-rose-950/95 border-rose-500 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.35)]'
              : 'bg-zinc-950/95 border-red-500/60 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
          }`}
        >
          {errorToast.isSecurity ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${
              errorToast.isSecurity ? 'text-rose-400' : 'text-red-500'
            }`}>
              {errorToast.isSecurity ? 'GUARDRAIL INTERCEPT' : 'COMPILER ALERT'}
            </div>
            <div className="text-zinc-200 font-mono text-[11px] mt-0.5">
              {errorToast.message}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorToast((prev) => ({ ...prev, visible: false }))}
            className="text-zinc-500 hover:text-zinc-200 cursor-pointer p-0.5"
            aria-label="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}

      {/* Bottom Command Dock */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-4 flex flex-col gap-2">
        {/* Options on top of input: Interstellar Phenomena & Baseline Laws */}
        <div className="flex flex-col gap-1.5 w-full">
          {/* Top Options: 3 Big Interstellar Blender-Level Phenomena */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {INTERSTELLAR_PRESETS.map((p) => {
              const isSelected = activeRules.some(
                (r) => r.phenomenon === p.phenomenon || (r.raw && r.raw.phenomenon === p.phenomenon)
              );
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 text-left font-mono tracking-wider border backdrop-blur-md transition-all cursor-pointer flex items-center justify-between text-xs active:translate-y-px ${
                    isSelected
                      ? 'bg-amber-950/70 border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                      : 'bg-zinc-950/85 hover:bg-zinc-900 border-white/15 hover:border-amber-500/50 text-zinc-300 hover:text-white'
                  }`}
                  title={p.description}
                >
                  <span className="font-semibold truncate">{p.pillLabel}</span>
                  <span className="text-[9px] px-1 py-0.2 bg-zinc-900 border border-white/10 text-amber-400 font-bold shrink-0 ml-1">
                    VFX
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary Options: Classic Physical Laws */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {BASELINE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-2 py-1 text-[10px] text-left truncate font-mono tracking-wider bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 hover:border-white/30 text-zinc-400 hover:text-zinc-100 backdrop-blur-md active:translate-y-px transition-all cursor-pointer"
                title={preset.description}
              >
                {preset.pillLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Sharp Command Input with Animated Cyan Border Pulse when Compiling */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCompile();
          }}
          className={`flex items-center gap-2 p-1.5 bg-zinc-950/90 backdrop-blur-md border text-xs transition-all duration-300 ${
            isCompiling
              ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse'
              : 'border-white/15'
          }`}
        >
          {/* Stack Mode Toggle Pill (APPEND / REPLACE) */}
          <button
            type="button"
            onClick={() => setStackMode((m) => (m === 'APPEND' ? 'REPLACE' : 'APPEND'))}
            className={`px-2 py-1 text-[10px] font-mono font-semibold tracking-wider uppercase border transition-colors cursor-pointer shrink-0 ${
              stackMode === 'APPEND'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
            }`}
            title={`Stack mode: ${stackMode}. Click to switch between APPEND (stack rules) and REPLACE (clear previous rules).`}
          >
            {stackMode}
          </button>

          <div className="flex items-center gap-1 text-zinc-500 font-mono select-none">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-600">&gt;</span>
          </div>

          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="Enter physical law... e.g. 'Gold blocks attract red circles and gravity flips every 3s'"
            className="flex-1 bg-transparent border-none text-zinc-200 placeholder:text-zinc-600 text-xs font-mono focus:outline-none px-1 py-1 tabular-nums"
          />

          <button
            type="submit"
            disabled={isCompiling}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-100 hover:bg-white active:bg-zinc-300 text-zinc-950 text-xs font-mono font-semibold tracking-wider uppercase border border-white active:translate-y-px transition-all cursor-pointer disabled:opacity-50"
          >
            <Cpu className={`w-3 h-3 text-zinc-950 ${isCompiling ? 'animate-spin' : ''}`} />
            <span>{isCompiling ? 'SCANNING...' : 'COMPILE'}</span>
          </button>
        </form>
      </footer>
    </div>
  );
}
