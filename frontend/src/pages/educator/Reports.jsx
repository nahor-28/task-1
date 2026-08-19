import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function Reports() {
  const { token } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('studentId');
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [id, setId] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/users?role=student', token),
      api.get('/groups', token),
    ])
      .then(([s, g]) => {
        setStudents(s);
        setGroups(g);
      })
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLookup(e) {
    e.preventDefault();
    setReport(null);
    try {
      const data = await api.get(`/reports?${mode}=${encodeURIComponent(id)}`, token);
      setReport(data);
    } catch (err) {
      toast.error(err.message);
    }
  }

  const options = mode === 'studentId' ? students : groups;

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Reports</h1>
      <form onSubmit={handleLookup} className="flex gap-2 mb-6">
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setId('');
            setReport(null);
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="studentId">By student</option>
          <option value="groupId">By group</option>
        </select>
        <select
          required
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="" disabled>
            {mode === 'studentId' ? 'Select a student' : 'Select a group'}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button type="submit" className="bg-gray-900 text-white text-sm rounded px-4 py-2">Look up</button>
      </form>

      {report && mode === 'studentId' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-3">
            Completion rate: <span className="font-medium text-gray-900">{Math.round(report.completionRate * 100)}%</span>
          </p>
          <ul className="space-y-1">
            {report.assignments.map((a) => (
              <li key={a.id} className="flex justify-between text-sm text-gray-700">
                <span>{a.title}</span>
                <span className="text-gray-900 font-medium">{a.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report && mode === 'groupId' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-3">
            Group completion rate: <span className="font-medium text-gray-900">{Math.round(report.completionRate * 100)}%</span>
          </p>
          <ul className="space-y-1">
            {report.members.map((m) => (
              <li key={m.studentId} className="flex justify-between text-sm text-gray-700">
                <span>{m.name}</span>
                <span className="text-gray-900 font-medium">{Math.round(m.completionRate * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
