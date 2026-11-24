import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  detail: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      detail: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'An unexpected rendering error occurred.';
    let detail: string | null = null;

    if (message.startsWith('{') && message.includes('"operationType"')) {
      try {
        const parsed = JSON.parse(message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        message = parsed.error || 'Database permission or network constraint encountered.';
        detail = `Operation: ${parsed.operationType || 'unknown'} · Path: ${parsed.path || 'unknown'}`;
      } catch {
        // Keep original message
      }
    }

    return {
      hasError: true,
      message,
      detail
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('News Hub 24+ ErrorBoundary caught error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#FBF9F5] dark:bg-[#0D0D0C] text-[#141413] dark:text-[#F5F3EE] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-[#171715] border border-[#DFDBD2] dark:border-[#2C2A26] rounded-lg p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#991B1B] dark:text-[#F87171] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h2 className="font-serif text-xl font-bold">
                News Hub 24+ Recovery Notice
              </h2>
              <p className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed">
                {this.state.message}
              </p>
              {this.state.detail && (
                <p className="font-mono text-xs text-[#78716C] dark:text-[#A8A29E] break-all">
                  {this.state.detail}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '', detail: null })}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#141413] dark:bg-[#F5F3EE] dark:text-[#141413] rounded-md hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Newsroom View</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
