import Dialog from '../components/Dialog';
import ErrorAlert from './ErrorAlert';
import type { Draft } from './types';

interface ConfirmDialogProps {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  error?: unknown;
  draft?: Draft;
  onConfirm: () => void;
  onCancel: () => void;
  onReload?: () => void;
}

/** Deliberate-action confirmation. Focus starts on Cancel so Enter never confirms by accident. */
export default function ConfirmDialog({ title, children, confirmLabel, tone = 'primary', busy, error, draft, onConfirm, onCancel, onReload }: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <button type="button" data-autofocus onClick={onCancel} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-500 hover:bg-primary-600'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        {children}
        {error != null && <ErrorAlert error={error} draft={draft} onReload={onReload} />}
      </div>
    </Dialog>
  );
}
