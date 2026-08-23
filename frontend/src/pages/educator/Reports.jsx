import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function Reports() {
  const { token } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    api.get('/users?role=student', token).then(setStudents).catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLookup(e) {
    e.preventDefault();
    setReport(null);
    setLooking(true);
    try {
      setReport(await api.get(`/reports?studentId=${studentId}`, token));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLooking(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-base-content mb-4">Reports</h1>
      <form onSubmit={handleLookup} className="flex gap-2 mb-6 max-w-lg">
        <select
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="select flex-1"
        >
          <option value="" disabled>Select a student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" disabled={looking} className="btn btn-primary">
          {looking && <span className="loading loading-spinner loading-sm" />}
          Look up
        </button>
      </form>

      {report && (
        <div className="card bg-base-100 shadow-sm border border-base-300 max-w-lg">
          <div className="card-body">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-base-content/70">Completion rate</p>
              <p className="text-sm font-medium text-base-content">{Math.round(report.completionRate * 100)}%</p>
            </div>
            <progress className="progress progress-primary mb-3" value={report.completionRate * 100} max="100" />
            <ul className="flex flex-col divide-y divide-base-300">
              {report.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm text-base-content">{a.title}</span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
