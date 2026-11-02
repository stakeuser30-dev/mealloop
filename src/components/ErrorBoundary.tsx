import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MealLoop Uncaught App Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore in strict sandboxes
    }
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-[#22C55E]/30 selection:text-white">
          <div className="max-w-lg w-full bg-[#111B2E] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            
            {/* Header / Brand Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase font-mono tracking-widest text-[#22C55E] font-bold">
                MealLoop Recovery Portal
              </span>
              <h1 className="text-2xl font-black text-white">
                Something interrupted the app
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                We caught a runtime issue and prevented a blank screen. You can refresh the campus session or reset cached credentials below.
              </p>
            </div>

            {/* Error detail snippet */}
            {this.state.error && (
              <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-3 text-left overflow-x-auto max-h-36">
                <span className="text-[10px] font-mono text-rose-400 block break-all font-semibold">
                  {this.state.error.toString()}
                </span>
              </div>
            )}

            {/* Recovery actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Portal
              </button>

              <button
                onClick={this.handleResetStorage}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#162238] hover:bg-[#1E2D4A] border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Clear Local Session
              </button>
            </div>

            <div className="border-t border-slate-800/80 pt-4 text-[11px] text-slate-500">
              SAC Central Campus Food Court · Counter 2 Pickup Platform
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
