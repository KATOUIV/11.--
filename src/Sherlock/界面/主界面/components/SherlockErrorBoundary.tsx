import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 出错时展示；未提供则使用默认文案 */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 弹窗/重组件出错时兜底，避免整棵 React 树卸载导致 iframe 全黑。
 */
export class SherlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Sherlock] UI error:', error.message, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-sherlock-red/35 bg-black/50 p-4 text-center text-sm text-sherlock-text-secondary">
            此面板暂时无法显示，请关闭浮层或刷新案卷后再试。
          </div>
        )
      );
    }
    return this.props.children;
  }
}
