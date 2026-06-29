import './DailyPrompt.css';

/**
 * DailyPrompt — Soft typographic daily check-in panel at top of The Slate.
 *
 * Props:
 *   prompt: string — the check-in question to display
 *   timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
 */

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

const PROMPTS = {
  morning: [
    "How did you sleep? What's the first thought you're carrying today?",
    "What one thing would make today feel like a win?",
    "What are you bringing into this morning?",
  ],
  afternoon: [
    "How is your energy tracking right now?",
    "What's the heaviest thing on your mind this afternoon?",
    "Where did your focus go today — and was that intentional?",
  ],
  evening: [
    "How is your focus tracking this evening?",
    "What moment today surprised you — positively or not?",
    "What do you want to let go of before tomorrow?",
  ],
  night: [
    "What's still unresolved that your mind is holding?",
    "If today had a single word, what would it be?",
    "What are three things that happened today worth remembering?",
  ],
};

function getDailyPrompt(timeOfDay) {
  const pool = PROMPTS[timeOfDay] || PROMPTS.evening;
  // Deterministic selection based on day of year — same prompt all day
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

const GREETING = {
  morning:   'Good morning',
  afternoon: 'Good afternoon',
  evening:   'Good evening',
  night:     'Late night thoughts',
};

const ICON = {
  morning:   '🌤',
  afternoon: '☀️',
  evening:   '🌙',
  night:     '✦',
};

export default function DailyPrompt() {
  const timeOfDay = getTimeOfDay();
  const prompt    = getDailyPrompt(timeOfDay);
  const greeting  = GREETING[timeOfDay];
  const icon      = ICON[timeOfDay];

  return (
    <div className={`daily-prompt daily-prompt--${timeOfDay}`} aria-label="Daily check-in prompt">
      <div className="daily-prompt__inner">
        <div className="daily-prompt__meta">
          <span className="daily-prompt__icon" aria-hidden="true">{icon}</span>
          <span className="daily-prompt__greeting">{greeting}</span>
        </div>
        <p className="daily-prompt__question" aria-live="polite">
          {prompt}
        </p>
      </div>
    </div>
  );
}
