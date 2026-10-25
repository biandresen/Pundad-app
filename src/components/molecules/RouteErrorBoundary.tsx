import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { hasUnsavedChanges, reloadPage } from "../../lib/releaseRecovery";

type BoundaryProps = { children: ReactNode; fallback: ReactNode; routeKey: string };

class ErrorBoundary extends Component<BoundaryProps, { failed: boolean; routeKey: string }> {
  state = { failed: false, routeKey: this.props.routeKey };

  static getDerivedStateFromProps(props: BoundaryProps, state: { routeKey: string }) {
    return props.routeKey === state.routeKey ? null : { failed: false, routeKey: props.routeKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { t } = useLanguage();
  return <ErrorBoundary routeKey={location.key} fallback={
    <div role="alert" className="p-4">
      <p>{t("releaseRecovery.failed")}</p>
      {!hasUnsavedChanges() && <button type="button" onClick={reloadPage}>{t("releaseRecovery.reload")}</button>}
    </div>
  }>{children}</ErrorBoundary>;
}
