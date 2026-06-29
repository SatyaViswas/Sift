import { useNavigation } from '../../context/NavigationContext';
import AppHeader from '../AppHeader/AppHeader';
import BottomNav from '../BottomNav/BottomNav';
import SidebarNav from '../SidebarNav/SidebarNav';
import SectionManager from '../SectionManager/SectionManager';
import './Chassis.css';

/**
 * Chassis — Adaptive Structural Layout.
 *
 * Mobile  (< 768px): Full-viewport native app flow.
 *   → AppHeader (top) + SectionManager (scroll) + BottomNav (anchored bottom)
 *
 * Desktop (≥ 768px): Full-width premium dashboard.
 *   → SidebarNav (fixed left 260px) + SectionManager (expansive right panel)
 *   → AppHeader and BottomNav are hidden on desktop.
 */
export default function Chassis() {
  const { activeTab } = useNavigation();

  return (
    <div className={`app-root app-root--${activeTab}`} role="application">
      {/* Desktop ambient glow blobs — CSS hides on mobile */}
      <div className="app-root__blob app-root__blob--1" aria-hidden="true" />
      <div className="app-root__blob app-root__blob--2" aria-hidden="true" />

      {/* ── Sidebar: visible only on desktop ── */}
      <SidebarNav />

      {/* ── Main content column ── */}
      <div className="app-root__main">
        {/* Mobile-only top header */}
        <AppHeader />

        {/* Section workspace — expands to fill available space */}
        <SectionManager />

        {/* Mobile-only bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
