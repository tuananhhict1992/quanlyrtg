import React from "react";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; error?: Error }
> {
  state = { failed: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) {
    return { failed: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="p-8 text-center max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-slate-800">Không thể hiển thị phân hệ</h1>
        <p className="text-slate-600 mt-1">Dữ liệu đã lưu vẫn được giữ. Vui lòng tải lại.</p>
        <button
          className="mt-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2 font-bold text-sm shadow-xs cursor-pointer"
          onClick={() => location.reload()}
        >
          Tải lại
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
