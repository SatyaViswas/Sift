import { useState, useEffect } from 'react';
import { useMemory } from '../../../context/MemoryContext';
import MemorySafeguardModal from '../../MemorySafeguardModal/MemorySafeguardModal';
import './BlindspotSection.css';

/**
 * BlindspotSection — Phase 6: Analytics Matrix Integration.
 * Parses { data: [{ title, description, type }] } from the backend.
 * Handles 404 Empty State gracefully.
 */
export default function BlindspotSection() {
  const { blindspotsData, isBlindspotsLoading: loading, refreshBlindspots } = useMemory();
  const [safeguardTopic, setSafeguardTopic] = useState(null);
  const [localInsights, setLocalInsights] = useState(null); // to allow manual filtering of dissolved items

  useEffect(() => {
    if (!blindspotsData && !loading) {
      refreshBlindspots();
    }
  }, [blindspotsData, loading, refreshBlindspots]);

  let insights = [];
  let emptyState = false;
  let lastFetched = null;
  let error = null;

  if (blindspotsData) {
    if (blindspotsData.status === 'success' && Array.isArray(blindspotsData.data)) {
      insights = blindspotsData.data;
    } else {
      insights = blindspotsData.blindspots || blindspotsData.patterns || blindspotsData.insights || [];
    }
    if (blindspotsData.last_synced) {
      lastFetched = new Date(blindspotsData.last_synced);
    } else {
      lastFetched = new Date();
    }
  }

  // Allow local removal of insights without refetching immediately
  useEffect(() => {
    if (insights.length > 0) {
      setLocalInsights(insights);
    }
  }, [insights]);
  
  const displayInsights = localInsights || insights;

  const getSentimentColor = (type) => {
    if (!type) return 'neutral';
    const t = type.toLowerCase();
    if (t === 'positive') return 'positive';
    if (t === 'negative') return 'negative';
    return 'neutral';
  };

  return (
    <section className="blindspot-section" aria-label="Blindspots — Long-Term Insight Feed">

      {/* ── Section Header ── */}
      <div className="blindspot-section__header">
        <div>
          <h1 className="blindspot-section__title">Blindspots</h1>
          <p className="blindspot-section__subtitle">Patterns you keep revisiting</p>
        </div>
        <button
          id="blindspot-refresh-btn"
          className="blindspot-refresh-btn"
          onClick={() => refreshBlindspots(true)}
          disabled={loading}
          aria-label="Refresh insights"
        >
          <svg
            viewBox="0 0 24 24" fill="none" width="16" height="16"
            className={loading ? 'spinning' : ''}
            aria-hidden="true"
          >
            <path d="M21 2v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Stats Bar ── */}
      {!loading && displayInsights.length > 0 && (
        <div className="blindspot-stats" aria-label="Summary statistics">
          <div className="blindspot-stat">
            <span className="blindspot-stat__num">{displayInsights.length}</span>
            <span className="blindspot-stat__label">patterns</span>
          </div>
          <div className="blindspot-stat__divider" aria-hidden="true" />
          <div className="blindspot-stat">
            <span className="blindspot-stat__num">
              {displayInsights.filter(i => i.type?.toLowerCase() === 'positive').length}
            </span>
            <span className="blindspot-stat__label">positive</span>
          </div>
          <div className="blindspot-stat__divider" aria-hidden="true" />
          <div className="blindspot-stat">
            <span className="blindspot-stat__num">
              {lastFetched ? lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
            <span className="blindspot-stat__label">last synced</span>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="blindspot-error" role="alert">
          <span>⚠ {error}</span>
        </div>
      )}

      {/* ── Insight Cards ── */}
      <div className="blindspot-feed" aria-label="Insight cards">
        {loading ? (
          /* ── Premium Skeleton Loaders (Shimmer) ── */
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="blindspot-skeleton-shimmer" aria-hidden="true">
              <div className="blindspot-skeleton-shimmer__bar" style={{ width: `${60 + i * 7}%` }} />
              <div className="blindspot-skeleton-shimmer__bar blindspot-skeleton-shimmer__bar--sm" style={{ width: `${40 + i * 5}%` }} />
              <div className="blindspot-skeleton-shimmer__tag" />
            </div>
          ))
        ) : emptyState ? (
          /* ── 404 No Dataset State ── */
          <div className="blindspot-empty">
            <div className="blindspot-empty__icon" aria-hidden="true">🌱</div>
            <p className="blindspot-empty__title">Your map is just beginning</p>
            <p className="blindspot-empty__body">
              There aren't enough journal entries yet to map your behavioral blindspots. 
              Keep logging your thoughts in The Slate, and check back soon.
            </p>
          </div>
        ) : displayInsights.length === 0 ? (
          <div className="blindspot-empty">
            <div className="blindspot-empty__icon" aria-hidden="true">🧠</div>
            <p className="blindspot-empty__title">No patterns detected yet</p>
            <p className="blindspot-empty__body">
              Keep writing in The Slate. The Oracle will surface recurring
              themes and cognitive patterns as your journal grows.
            </p>
          </div>
        ) : (
          displayInsights.map((insight, i) => (
            <article
              key={i}
              className={`blindspot-card blindspot-card--${getSentimentColor(insight.type)}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="blindspot-card__accent" aria-hidden="true" />
              <div className="blindspot-card__body">
                <p className="blindspot-card__pattern">
                  {insight.title || insight.pattern || 'Unnamed pattern'}
                </p>
                <p className="blindspot-card__description">
                  {insight.description || (insight.examples && insight.examples[0]) || ''}
                </p>
                
                <div className="blindspot-card__meta">
                  {insight.type && (
                    <span className={`blindspot-card__chip blindspot-card__chip--${getSentimentColor(insight.type)}`}>
                      {insight.type}
                    </span>
                  )}
                  {insight.frequency != null && (
                    <span className="blindspot-card__chip blindspot-card__chip--freq">
                      {insight.frequency}× seen
                    </span>
                  )}
                </div>

                <div className="blindspot-card__actions">
                  <button 
                    className="blindspot-card__btn-prune"
                    onClick={() => setSafeguardTopic(insight.title || insight.pattern)}
                  >
                    Dissolve Connection
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {safeguardTopic && (
        <MemorySafeguardModal 
          topic={safeguardTopic} 
          onClose={() => setSafeguardTopic(null)} 
          onForgotten={() => {
            setSafeguardTopic(null);
            if (localInsights) {
              setLocalInsights(prev => prev.filter(i => (i.title || i.pattern) !== safeguardTopic));
            }
          }} 
        />
      )}

    </section>
  );
}

/** Demo scaffold data for visual verification when backend is offline */
const DEMO_INSIGHTS = [
  {
    title: "Decision paralysis around major career choices",
    description: "You consistently delay committing to large professional changes, citing 'need for more data' as a recurring block.",
    type: "negative",
  },
  {
    title: "Morning clarity peaks between 7–9 AM",
    description: "Your most structured, optimistic, and forward-looking entries almost exclusively happen before 9 AM.",
    type: "positive",
  },
  {
    title: "Circadian Cognitive Erosion",
    description: "Energy dips mid-afternoon severely correlate with days where you skip your 1PM walking block.",
    type: "negative",
  },
  {
    title: "Gratitude journaling correlates with better sleep",
    description: "When you list 3 things you're grateful for at night, your morning entries report 40% deeper perceived rest.",
    type: "positive",
  },
];
