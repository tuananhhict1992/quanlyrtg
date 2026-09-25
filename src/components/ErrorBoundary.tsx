import React from "react";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="p-8 text-center">
        <h1 className="text-xl font-bold">Không thể hiển thị phân hệ</h1>
        <p>Dữ liệu đã lưu vẫn được giữ. Vui lòng tải lại.</p>
        <button
          className="mt-4 rounded-lg border px-4 py-2"
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
