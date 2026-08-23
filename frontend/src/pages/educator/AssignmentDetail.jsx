import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { AttachmentViewer } from '../../components/AttachmentViewer.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function AssignmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [gradingId, setGradingId] = useState(null);
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    try {
      const [a, subs] = await Promise.all([
        api.get(`/assignments/${id}`, token),
        api.get(`/submissions?assignmentId=${id}`, token),
      ]);
      setAssignment(a);
      setSubmissions(subs);
    } catch (err) {
      setLoadError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function doPublish() {
    try {
      await api.post(`/assignments/${id}/publish`, undefined, token);
      toast.success('Assignment published.');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function doGrade(submissionId) {
    setGradingId(submissionId);
    try {
      await api.patch(`/submissions/${submissionId}/grade`, undefined, token);
      toast.success('Marked graded.');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGradingId(null);
    }
  }

  async function doDelete() {
    try {
      await api.del(`/assignments/${id}`, token);
      toast.success('Assignment deleted.');
      navigate('/educator/assignments');
    } catch (err) {
      toast.error(err.message);
    }
  }

  function handleDelete() {
    confirm('Delete assignment?', `Delete "${assignment.title}"? This cannot be undone.`, doDelete);
  }

  function handlePublish() {
    const impact = assignment.type === 'group'
      ? `This randomly forms ${assignment.numGroups} group(s) from enrolled students.`
      : 'This creates a submission for every enrolled student.';
    confirm('Publish assignment?', `Publish "${assignment.title}"? ${impact} This cannot be undone.`, doPublish);
  }

  if (loadError) return <div className="alert alert-error"><span>{loadError}</span></div>;
  if (!assignment) return <div className="space-y-6"><div className="skeleton h-40 rounded-box" /><div className="skeleton h-56 rounded-box" /></div>;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
            <div>
              <h1 className="text-lg font-semibold text-base-content">{assignment.title}</h1>
              <p className="text-xs text-base-content/60 mt-1">
                {assignment.type === 'group' ? `Group (${assignment.numGroups} groups)` : 'Individual'}
                {' · '}
                <span className="capitalize">{assignment.status}</span>
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {assignment.status === 'draft' && (
                <button onClick={handlePublish} className="btn btn-primary btn-sm">
                  Publish
                </button>
              )}
              <Link to={`/educator/assignments/${id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
              <button onClick={handleDelete} className="btn btn-ghost btn-sm text-error">Delete</button>
            </div>
          </div>
          <p className="text-sm text-base-content/60 mb-2">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
          <p className="text-sm text-base-content/80 mb-3">{assignment.description}</p>
          <AttachmentViewer url={assignment.attachmentUrl} />
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <h2 className="font-medium text-base-content mb-3">Submission status</h2>
          {submissions.length === 0 && (
            <p className="text-sm text-base-content/60">
              {assignment.status === 'draft' ? 'Publish this assignment to see submissions.' : 'No submissions yet.'}
            </p>
          )}
          <ul className="flex flex-col divide-y divide-base-300">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-base-content">{s.studentName}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {s.status === 'waiting_for_grading' && (
                    <button
                      onClick={() => doGrade(s.id)}
                      disabled={gradingId === s.id}
                      className="btn btn-primary btn-xs"
                    >
                      {gradingId === s.id && <span className="loading loading-spinner loading-xs" />}
                      Grade
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
