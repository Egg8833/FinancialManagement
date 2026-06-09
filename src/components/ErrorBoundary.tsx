"use client";

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 gap-2">
          <span className="text-sm">圖表載入失敗</span>
          <button
            className="text-xs text-indigo-500 hover:text-indigo-700"
            onClick={() => this.setState({ hasError: false })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
