import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useConfirm } from '../../hooks/useConfirm.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

export function AssignmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [targetType, setTargetType] = useState('student');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [error, setError] = useState('');
  const { confirm, dialogProps } = useConfirm();

  async function load() {
    try {
      const [a, subs, allStudents, allGroups] = await Promise.all([
        api.get(`/assignments/${id}`, token),
        api.get(`/submissions?assignmentId=${id}`, token),
        api.get('/users?role=student', token),
        api.get('/groups', token),
      ]);
      setAssignment(a);
      setSubmissions(subs);
      setStudents(allStudents);
      setGroups(allGroups);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function doAssign() {
    setError('');
    try {
      const targetId = targetType === 'student' ? targetStudentId : targetGroupId;
      await api.post(`/assignments/${id}/assign`, { targetType, targetId }, token);
      setTargetStudentId('');
      setTargetGroupId('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAssign(e) {
    e.preventDefault();
    const targetLabel = targetType === 'student'
      ? students.find((s) => s.id === targetStudentId)?.name
      : groups.find((g) => g.id === targetGroupId)?.name;
    confirm('Assign?', `Assign "${assignment.title}" to ${targetLabel}?`, doAssign);
  }

  async function doDelete() {
    setError('');
    try {
      await api.del(`/assignments/${id}`, token);
      navigate('/educator/assignments');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDelete() {
    confirm('Delete assignment?', `Delete "${assignment.title}"? This cannot be undone.`, doDelete);
  }

  if (!assignment) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-gray-900">{assignment.title}</h1>
          <div className="flex gap-2">
            <Link to={`/educator/assignments/${id}/edit`} className="text-sm text-gray-600 underline">Edit</Link>
            <button onClick={handleDelete} className="text-sm text-red-600">Delete</button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-2">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
        <p className="text-sm text-gray-700">{assignment.description}</p>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Assign to</h2>
        <form onSubmit={handleAssign} className="flex gap-2 items-end">
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="student">Student</option>
            <option value="group">Group</option>
          </select>
          {targetType === 'student' ? (
            <select
              required
              value={targetStudentId}
              onChange={(e) => setTargetStudentId(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="" disabled>Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <select
              required
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="" disabled>Select a group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="bg-gray-900 text-white text-sm rounded px-4 py-2">Assign</button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Submission status</h2>
        {submissions.length === 0 && <p className="text-sm text-gray-500">No students assigned yet.</p>}
        <ul className="space-y-1">
          {submissions.map((s) => (
            <li key={s.studentId} className="flex justify-between text-sm text-gray-700">
              <span>{s.studentName}</span>
              <span className="font-medium text-gray-900">{s.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
