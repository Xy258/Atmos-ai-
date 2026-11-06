import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Layers,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function AndroidInstallButton({
  className = '',
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { isInstalled, isAndroid, isInstallable, install } = usePWAInstall();

  if (isInstalled) {
    if (iconOnly) {
      return (
        <div
          className={`icon-btn border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 ${className}`}
          title="Atmos is installed and running in standalone Android mode"
          aria-label="Android App Active"
        >
          <Smartphone size={16} />
        </div>
      );
    }
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 ${className}`}
        title="Atmos is installed and running in standalone app mode"
      >
        <Smartphone size={13} />
        <span>Android App Active</span>
      </div>
    );
  }

  if (iconOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              void install();
            } else {
              setIsOpen(true);
            }
          }}
          className={`icon-btn ${className}`}
          data-testid="button-install-android-app"
          aria-label={isInstallable ? 'Install on Android' : 'Get Android App'}
          title={isInstallable ? 'Install Atmos on Android' : 'Get Android App'}
        >
          <Smartphone size={16} className={isAndroid ? 'text-amber-500 dark:text-amber-400' : 'text-foreground/80'} />
        </button>

        <AndroidInstallModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            void install();
          } else {
            setIsOpen(true);
          }
        }}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm ${
          isAndroid
            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-amber-500/20'
            : 'bg-card/80 hover:bg-card text-foreground border border-border/80 hover:border-amber-500/50'
        } ${className}`}
        data-testid="button-install-android-app"
        aria-label="Install Atmos as Android App"
      >
        <Smartphone size={14} className={isAndroid ? 'text-slate-950' : 'text-amber-500'} />
        <span>{isInstallable ? 'Install on Android' : 'Get Android App'}</span>
      </button>

      <AndroidInstallModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function AndroidInstallModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { isInstallable, isAndroid, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk'>('pwa');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const capacitorCommands = `npm i -D @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Atmos Weather" com.atmos.weather --web-dir dist/public
npm run build
npx cap add android
npx cap open android`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="android-modal-title"
          >
            {/* Top Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Smartphone size={22} />
              </div>
              <div>
                <h2 id="android-modal-title" className="text-lg font-bold tracking-tight text-foreground">
                  Atmos on Android
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Two ways to run Atmos as an Android app on your device
                </p>
              </div>
            </div>

            {/* Method Tabs */}
            <div className="flex rounded-lg bg-muted/60 p-1 mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('pwa')}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'pwa'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                1. Instant Android Install (PWA)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('apk')}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'apk'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                2. Native APK (Capacitor)
              </button>
            </div>

            {/* Tab 1: Instant PWA Install on Android */}
            {activeTab === 'pwa' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Sparkles size={14} className="text-amber-500" />
                    <span>Native WebAPK Android App</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Android natively installs Atmos as an authentic app with its own home screen icon, splash screen, offline caching, and fullscreen window without any browser search bar.
                  </p>

                  <div className="space-y-2 pt-1 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold flex-shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Open this app URL in <strong>Chrome</strong>, <strong>Samsung Internet</strong>, or <strong>Brave</strong> on your Android phone.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold flex-shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Tap the <strong>⋮ (Menu)</strong> button at the top right of the browser.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold flex-shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                      </span>
                    </div>
                  </div>
                </div>

                {isInstallable ? (
                  <button
                    type="button"
                    onClick={() => void install()}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                  >
                    <Download size={15} />
                    <span>Install Atmos to Android Now</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 size={16} />
                      <span className="font-medium">Web App Manifest & Icons Ready</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Android 8+ Compatible</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Native APK generation with Capacitor */}
            {activeTab === 'apk' && (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 text-xs text-muted-foreground space-y-2">
                  <p className="leading-relaxed">
                    To compile an <strong>.apk</strong> or <strong>.aab</strong> file for Google Play Store or direct sideloading, you can wrap this app with <strong>Capacitor</strong>:
                  </p>
                </div>

                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800">
                    {capacitorCommands}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(capacitorCommands, 'cap')}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition"
                    title="Copy commands"
                  >
                    {copiedCmd === 'cap' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                  <ShieldCheck size={14} className="text-amber-500" />
                  <span>Opens directly in Android Studio ready to build Signed APK.</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-mono">
                Atmos Weather v1.0 · PWA & Android Ready
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
