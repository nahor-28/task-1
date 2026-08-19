import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { AttachmentViewer } from '../../components/AttachmentViewer.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const STATUS_LABEL = {
  not_submitted: 'Not submitted',
  pending_confirmation: 'Pending confirmation',
  confirmed: 'Confirmed',
};

export function AssignmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [uploaded, setUploaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    try {
      const [a, s] = await Promise.all([
        api.get(`/assignments/${id}`, token),
        api.get(`/submissions/mine?assignmentId=${id}`, token),
      ]);
      setAssignment(a);
      setSubmission(s);
    } catch (err) {
      setLoadError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function doSubmit() {
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

  if (!assignment) return loadError ? <p className="text-sm text-red-600">{loadError}</p> : null;

  const needsUploadGate = Boolean(assignment.onedriveLink) && !uploaded;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <ConfirmDialog {...dialogProps} />
      <h1 className="text-lg font-semibold text-gray-900">{assignment.title}</h1>
      <p className="text-sm text-gray-500 mb-1">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
      <p className="text-sm text-gray-700 mb-4">{assignment.description}</p>
      <AttachmentViewer url={assignment.attachmentUrl} />

      {assignment.onedriveLink && submission?.status === 'not_submitted' && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-800 mb-2">
            Upload your completed work to the OneDrive folder below, then confirm you've uploaded it to submit.
          </p>
          <a href={assignment.onedriveLink} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
            Open OneDrive upload folder
          </a>
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
            <input type="checkbox" checked={uploaded} onChange={(e) => setUploaded(e.target.checked)} />
            I've uploaded my work to the link above
          </label>
        </div>
      )}

      <hr className="my-4 border-gray-200" />

      <p className="text-sm text-gray-600 mb-3">
        Status: <span className="font-medium text-gray-900">{STATUS_LABEL[submission?.status]}</span>
      </p>

      {submission?.status === 'not_submitted' && (
        <button
          onClick={() => confirm('Submit assignment?', 'Confirm that you have completed and submitted your work.', doSubmit)}
          disabled={busy || needsUploadGate}
          className="bg-gray-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          Yes, I have submitted
        </button>
      )}
      {submission?.status === 'pending_confirmation' && (
        <button
          onClick={() => confirm('Confirm submission?', 'This is the final step and cannot be undone.', doConfirm)}
          disabled={busy}
          className="bg-gray-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          Confirm submission
        </button>
      )}
      {submission?.status === 'confirmed' && (
        <p className="text-sm text-green-700">Submission confirmed on {new Date(submission.confirmedAt).toLocaleDateString()}.</p>
      )}
    </div>
  );
}
