import { ShieldAlert } from 'lucide-react';

export default function Disclaimer() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-sm text-warn-500/90">
      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
      <div className="leading-relaxed">
        <strong className="text-warn-500">Educational copilot, not a medical device.</strong>{' '}
        Outputs may be wrong or incomplete. They do <em>not</em> establish a diagnosis or
        treatment plan. Always confirm with a licensed clinician and standard local guidelines.
      </div>
    </div>
  );
}
