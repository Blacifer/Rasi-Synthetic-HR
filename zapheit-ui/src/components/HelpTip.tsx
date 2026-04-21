import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTipProps {
  text: string;
  className?: string;
}

/**
 * Inline ? icon that shows a plain-English tooltip on hover/focus.
 * Usage: <HelpTip text="Scans every AI response for sensitive data..." />
 */
export function HelpTip({ text, className = '' }: HelpTipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label="More information"
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-slate-500 transition hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-300 shadow-xl"
        >
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </span>
      )}
    </span>
  );
}

/** Pre-wired tooltips for standard terms */
export const HELP_TIPS = {
  piiDetection: 'Scans every AI response for sensitive data like Aadhaar numbers, PAN cards, and phone numbers.',
  humanReview: 'Certain actions require your approval before the AI can proceed. Example: Expenses over ₹50,000.',
  howItDecided: 'See exactly what information the AI used and why it chose this response.',
  performanceRules: 'Ensure your AI responds within a target time and stays within your cost budget per conversation.',
  aiMessageHub: 'The secure connection between your apps and AI providers. All traffic is monitored and logged here.',
} as const;
