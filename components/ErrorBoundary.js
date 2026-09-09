import React from 'react';

/**
 * 全局错误边界：避免单个页面渲染错误导致整页无响应（按钮失效）
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, message: String((error && error.message) || error || '未知错误') };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex items-center justify-center p-6">
                    <div className="text-center max-w-md bg-panel rounded-2xl border border-red-500/30 p-8">
                        <i className="fa-solid fa-triangle-exclamation text-red-500 text-4xl mb-4"></i>
                        <h2 className="text-xl font-bold text-fg mb-2">页面渲染出现异常</h2>
                        <p className="text-fg-3 text-sm mb-4 break-all">{this.state.message}</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="px-5 py-2 bg-accent-solid text-accent-fg rounded-lg hover:bg-accent-solid-hover transition-colors text-sm font-medium"
                        >
                            <i className="fa-solid fa-rotate mr-1.5"></i>刷新页面
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
