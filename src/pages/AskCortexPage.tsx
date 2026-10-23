import AskCortex from '@/components/AskCortex';

const SUGGESTIONS = [
  'What are the three biggest financial risks right now?',
  'Which company code is most profitable, and why?',
  'How healthy is working capital across AP and AR?',
  'Which cost centers are driving expense growth?',
  'Which customers should collections chase first?',
  'How did revenue and expenses trend year over year?',
];

/** Cross-page Q&A: Cortex answers from a compact fact set spanning P&L, cost/profit centers, AP and AR. */
export default function AskCortexPage() {
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-sf-dark/70">
        Ask a question about Finance 360. Cortex answers from live facts drawn from the SAP BDC journal entries,
        supplier invoices and the cost center, profit center, AP and AR dynamic tables. Pick a suggestion or type your own.
      </p>
      <AskCortex topic="general" label="Analyse the finance position" suggestions={SUGGESTIONS} />
    </div>
  );
}
