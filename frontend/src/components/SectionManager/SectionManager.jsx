import { useRef, useEffect, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import SlateSection from '../sections/SlateSection/SlateSection';
import OracleSection from '../sections/OracleSection/OracleSection';
import BlindspotSection from '../sections/BlindspotSection/BlindspotSection';
import HistorySection from '../sections/HistorySection/HistorySection';
import './SectionManager.css';

const SECTION_MAP = {
  slate:       SlateSection,
  oracle:      OracleSection,
  blindspots:  BlindspotSection,
  history:     HistorySection,
};

/**
 * SectionManager — Renders the active section with directional slide transitions.
 * Animation class is applied for one frame to trigger CSS transitions, then cleared.
 */
export default function SectionManager() {
  const { activeTab, direction } = useNavigation();
  const [renderedTab, setRenderedTab] = useState(activeTab);
  const [animClass, setAnimClass]     = useState('');
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (activeTab === prevTabRef.current) return;

    // Map direction → CSS animation class for the entering section
    const directionClassMap = {
      right: 'section--enter-right',
      left:  'section--enter-left',
      up:    'section--enter-up',
      down:  'section--enter-up', // Blindspots always enters from up
    };

    setAnimClass(directionClassMap[direction] || 'section--enter-right');
    setRenderedTab(activeTab);
    prevTabRef.current = activeTab;

    // Remove animation class after transition completes
    const timer = setTimeout(() => setAnimClass(''), 350);
    return () => clearTimeout(timer);
  }, [activeTab, direction]);

  const ActiveSection = SECTION_MAP[renderedTab];

  return (
    <div className="section-manager">
      <div
        className={`section-manager__view ${animClass}`}
        key={renderedTab}
      >
        <ActiveSection />
      </div>
    </div>
  );
}
