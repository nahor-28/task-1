const STATUS = {
  not_submitted: { label: 'Not submitted', className: 'badge-ghost' },
  pending_confirmation: { label: 'Pending confirmation', className: 'badge-warning badge-soft' },
  waiting_for_grading: { label: 'Waiting for grading', className: 'badge-info badge-soft' },
  graded: { label: 'Graded', className: 'badge-success badge-soft' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, className: 'badge-ghost' };
  return (
    <span className={`badge ${s.className} gap-1`}>
      {status === 'graded' && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {s.label}
    </span>
  );
}
