import { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * NavigationContext — Manages active tab and slide transition direction.
 * Sections: 'slate' | 'oracle' | 'blindspots' | 'history'
 * 
 * Direction logic:
 *   slate ↔ oracle ↔ history : horizontal (left/right)
 *   any  ↔ blindspots : vertical (up/down)
 */
const NavigationContext = createContext(null);

const TAB_ORDER = ['slate', 'oracle', 'blindspots', 'history'];

function getDirection(from, to) {
  const fromIdx = TAB_ORDER.indexOf(from);
  const toIdx   = TAB_ORDER.indexOf(to);

  if (from === 'blindspots' || to === 'blindspots') {
    return to === 'blindspots' ? 'up' : 'down';
  }
  return toIdx > fromIdx ? 'right' : 'left';
}

export function NavigationProvider({ children }) {
  const [activeTab, setActiveTab]       = useState('slate');
  const [direction, setDirection]       = useState('right');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevTabRef = useRef('slate');

  const navigate = useCallback((tab) => {
    if (tab === activeTab || isTransitioning) return;
    const dir = getDirection(activeTab, tab);
    setDirection(dir);
    prevTabRef.current = activeTab;
    setIsTransitioning(true);
    setActiveTab(tab);
    // Transition lock releases after animation duration
    setTimeout(() => setIsTransitioning(false), 350);
  }, [activeTab, isTransitioning]);

  return (
    <NavigationContext.Provider value={{ activeTab, direction, isTransitioning, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside NavigationProvider');
  return ctx;
}
