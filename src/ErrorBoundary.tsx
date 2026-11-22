import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** 全局错误边界：任何子树崩溃都显示错误卡片+重试，而不是整个窗口白屏/关闭 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Boundary]", error.message, info.componentStack?.slice(0, 400));
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#f48771", fontFamily: "sans-serif" }}>
          <h3>界面出错了（应用未退出）</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#bbb" }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: "6px 16px", cursor: "pointer" }}
          >
            重试恢复
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
