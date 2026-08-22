import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { AttachmentViewer } from '../../components/AttachmentViewer.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const STATUS_LABEL = {
  not_submitted: 'Not submitted',
  pending_confirmation: 'Pending confirmation',
  waiting_for_grading: 'Waiting for grading',
  graded: 'Graded',
};

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

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!assignment) return null;

  const isGroup = assignment.type === 'group';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <ConfirmDialog {...dialogProps} />
      <h1 className="text-lg font-semibold text-gray-900">{assignment.title}</h1>
      <p className="text-sm text-gray-500 mb-1">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
      <p className="text-sm text-gray-700 mb-4">{assignment.description}</p>
      <AttachmentViewer url={assignment.attachmentUrl} />

      {isGroup && (
        <p className="mt-4 text-sm">
          <Link to={`/student/assignments/${id}/groups`} className="text-blue-700 underline">
            {submission ? 'View your group' : 'Browse and join a group'}
          </Link>
        </p>
      )}

      {isGroup && !submission && (
        <p className="mt-2 text-sm text-gray-500">Join a group above before you can submit.</p>
      )}

      {!isGroup && !submission && (
        <p className="mt-4 text-sm text-gray-500">
          No submission found for this assignment — this can happen if you enrolled after it was
          published. Contact your instructor if you think this is a mistake.
        </p>
      )}

      {submission && (
        <>
          {assignment.onedriveLink && submission.status !== 'graded' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 mb-2">
                {submission.status === 'not_submitted'
                  ? 'Upload your completed work to the OneDrive folder below.'
                  : "Need to fix something? You can still reopen the folder and re-upload before it's confirmed."}
              </p>
              <a href={assignment.onedriveLink} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
                Open OneDrive upload folder
              </a>
            </div>
          )}

          {submission.status === 'not_submitted' && (
            <label className="flex items-center gap-2 mt-4 text-sm text-gray-700">
              <input type="checkbox" checked={false} disabled={busy} onChange={handleAck} />
              I confirm I have completed and submitted this assignment
            </label>
          )}

          <hr className="my-4 border-gray-200" />

          <p className="text-sm text-gray-600 mb-3">
            Status: <span className="font-medium text-gray-900">{STATUS_LABEL[submission.status]}</span>
          </p>

          {submission.status === 'pending_confirmation' && !isGroup && (
            <button
              onClick={() => confirm('Confirm submission?', 'This is the final step and cannot be undone.', doConfirm)}
              disabled={busy}
              className="bg-gray-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
            >
              Confirm submission
            </button>
          )}
          {submission.status === 'pending_confirmation' && isGroup && (
            <p className="text-sm text-gray-500">Waiting for your group leader to confirm all submissions.</p>
          )}
          {submission.status === 'graded' && (
            <p className="text-sm text-green-700">
              Graded{submission.gradedAt ? ` on ${new Date(submission.gradedAt).toLocaleDateString()}` : ''}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
