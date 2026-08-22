import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function Reports() {
  const { token } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get('/users?role=student', token).then(setStudents).catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLookup(e) {
    e.preventDefault();
    setReport(null);
    try {
      setReport(await api.get(`/reports?studentId=${studentId}`, token));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Reports</h1>
      <form onSubmit={handleLookup} className="flex gap-2 mb-6">
        <select
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="" disabled>Select a student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" className="bg-gray-900 text-white text-sm rounded px-4 py-2">Look up</button>
      </form>

      {report && (
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
    </div>
  );
}
