import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { AttachmentViewer } from '../../components/AttachmentViewer.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

const STATUS_ORDER = ['not_submitted', 'pending_confirmation', 'waiting_for_grading', 'graded'];
const STATUS_LABEL = {
  not_submitted: 'Not submitted',
  pending_confirmation: 'Pending confirmation',
  waiting_for_grading: 'Waiting for grading',
  graded: 'Graded',
};

function SubmissionSteps({ status }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  return (
    <ul className="steps steps-vertical sm:steps-horizontal w-full">
      {STATUS_ORDER.map((s, i) => (
        <li key={s} className={`step text-sm ${i <= currentIndex ? 'step-primary' : ''}`}>
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

export function AssignmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    try {
      const a = await api.get(`/assignments/${id}`, token);
      setAssignment(a);
      try {
        setSubmission(await api.get(`/submissions/mine?assignmentId=${id}`, token));
      } catch {
        // No submission row yet — normal for an unjoined group assignment, or a
        // student who enrolled after an individual assignment was published.
        setSubmission(null);
      }
    } catch (err) {
      setLoadError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function handleAck(e) {
    if (!e.target.checked) return;
    setBusy(true);
    try {
      await api.patch(`/submissions/${submission.id}/submit`, undefined, token);
      toast.success('Submission recorded.');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doConfirm() {
    setBusy(true);
    try {
      await api.patch(`/submissions/${submission.id}/confirm`, undefined, token);
      toast.success('Submission confirmed.');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <div className="alert alert-error"><span>{loadError}</span></div>;
  if (!assignment) return <div className="skeleton h-64 rounded-box" />;

  const isGroup = assignment.type === 'group';

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <ConfirmDialog {...dialogProps} />
      <div className="card-body">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-lg font-semibold text-base-content">{assignment.title}</h1>
          {submission && <StatusBadge status={submission.status} />}
        </div>
        <p className="text-sm text-base-content/60 mb-2">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
        <p className="text-sm text-base-content/80 mb-4">{assignment.description}</p>
        <AttachmentViewer url={assignment.attachmentUrl} />

        {isGroup && (
          <p className="mt-4 text-sm">
            <Link to={`/student/assignments/${id}/groups`} className="link link-primary">
              {submission ? 'View your group' : 'Browse and join a group'}
            </Link>
          </p>
        )}

        {isGroup && !submission && (
          <p className="mt-2 text-sm text-base-content/60">Join a group above before you can submit.</p>
        )}

        {!isGroup && !submission && (
          <p className="mt-4 text-sm text-base-content/60">
            No submission found for this assignment — this can happen if you enrolled after it was
            published. Contact your instructor if you think this is a mistake.
          </p>
        )}

        {submission && (
          <>
            {assignment.onedriveLink && submission.status !== 'graded' && (
              <div className="alert alert-info alert-soft mt-4 items-start">
                <div>
                  <p className="text-sm mb-1">
                    {submission.status === 'not_submitted'
                      ? 'Upload your completed work to the OneDrive folder below.'
                      : "Need to fix something? You can still reopen the folder and re-upload before it's confirmed."}
                  </p>
                  <a href={assignment.onedriveLink} target="_blank" rel="noreferrer" className="link font-medium text-sm">
                    Open OneDrive upload folder
                  </a>
                </div>
              </div>
            )}

            {submission.status === 'not_submitted' && (
              <label className="flex items-center gap-2 mt-4 text-sm text-base-content cursor-pointer">
                <input type="checkbox" checked={false} disabled={busy} onChange={handleAck} className="checkbox checkbox-primary checkbox-sm" />
                I confirm I have completed and submitted this assignment
              </label>
            )}

            <div className="divider" />

            <SubmissionSteps status={submission.status} />

            {submission.status === 'pending_confirmation' && !isGroup && (
              <button
                onClick={() => confirm('Confirm submission?', 'This is the final step and cannot be undone.', doConfirm)}
                disabled={busy}
                className="btn btn-primary mt-4 self-start"
              >
                {busy && <span className="loading loading-spinner loading-sm" />}
                Confirm submission
              </button>
            )}
            {submission.status === 'pending_confirmation' && isGroup && (
              <p className="text-sm text-base-content/60 mt-4">Waiting for your group leader to confirm all submissions.</p>
            )}
            {submission.status === 'graded' && (
              <div className="alert alert-success alert-soft mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="text-sm">
                  Graded{submission.gradedAt ? ` on ${new Date(submission.gradedAt).toLocaleDateString()}` : ''}.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
