import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function Reports() {
  const { token, user } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/reports?studentId=${user.id}`, token)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [token, user.id]);

  if (error) return <div className="alert alert-error"><span>{error}</span></div>;

  if (!report) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 rounded-box" />
        <div className="skeleton h-64 rounded-box" />
      </div>
    );
  }

  const percent = Math.round(report.completionRate * 100);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-base-content">Your Progress</h1>

      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-base-content/70">Overall completion</p>
            <p className="text-sm font-medium text-base-content">{percent}%</p>
          </div>
          <progress className="progress progress-primary" value={percent} max="100" />
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          {report.assignments.length === 0 && <p className="text-sm text-base-content/60">No assignments yet.</p>}
          <ul className="flex flex-col divide-y divide-base-300">
            {report.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-base-content">{a.title}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
