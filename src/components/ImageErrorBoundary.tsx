import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Generic error boundary that catches render errors in children
 * and displays a fallback UI instead of crashing.
 */
export class ImageErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(): void {
        // Errors are suppressed; fallback UI is shown instead
    }

    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}
