import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { AttachmentViewer } from '../../components/AttachmentViewer.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function AssignmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadError, setLoadError] = useState('');
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
    try {
      await api.patch(`/submissions/${submissionId}/grade`, undefined, token);
      toast.success('Marked graded.');
      await load();
    } catch (err) {
      toast.error(err.message);
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

  if (!assignment) return loadError ? <p className="text-sm text-red-600">{loadError}</p> : null;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{assignment.title}</h1>
            <p className="text-xs text-gray-500 mt-1">
              {assignment.type === 'group' ? `Group (${assignment.numGroups} groups)` : 'Individual'} · {assignment.status}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {assignment.status === 'draft' && (
              <button onClick={handlePublish} className="bg-gray-900 text-white text-sm rounded px-4 py-2">
                Publish
              </button>
            )}
            <Link to={`/educator/assignments/${id}/edit`} className="text-sm text-gray-600 underline">Edit</Link>
            <button onClick={handleDelete} className="text-sm text-red-600">Delete</button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-2">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
        <p className="text-sm text-gray-700 mb-3">{assignment.description}</p>
        <AttachmentViewer url={assignment.attachmentUrl} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Submission status</h2>
        {submissions.length === 0 && (
          <p className="text-sm text-gray-500">
            {assignment.status === 'draft' ? 'Publish this assignment to see submissions.' : 'No submissions yet.'}
          </p>
        )}
        <ul className="space-y-1">
          {submissions.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm text-gray-700">
              <span>{s.studentName}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{s.status}</span>
                {s.status === 'waiting_for_grading' && (
                  <button onClick={() => doGrade(s.id)} className="text-xs bg-gray-900 text-white rounded px-2 py-1">
                    Grade
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
