import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const COUNT_BADGES = [
  { key: 'notSubmitted', label: 'Not submitted', className: 'badge-ghost' },
  { key: 'pendingConfirmation', label: 'Pending', className: 'badge-warning badge-soft' },
  { key: 'waitingForGrading', label: 'Waiting for grading', className: 'badge-info badge-soft' },
  { key: 'graded', label: 'Graded', className: 'badge-success badge-soft' },
];

export function EducatorDashboard() {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard', token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <div className="alert alert-error"><span>{error}</span></div>;

  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-box" />
        ))}
      </div>
    );
  }

  const courseTitle = (courseId) => data.courses.find((c) => c.id === courseId)?.title;
  const published = data.assignments.filter((a) => a.assignmentStatus === 'published').length;
  const totalGraded = data.assignments.reduce((sum, a) => sum + a.graded, 0);
  const totalPending = data.assignments.reduce((sum, a) => sum + a.pendingConfirmation + a.waitingForGrading, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-base-content">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-base-content/60">Here's what needs your attention.</p>
      </div>

      <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
        <div className="stat">
          <div className="stat-title">Courses taught</div>
          <div className="stat-value text-primary">{data.courses.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Published assignments</div>
          <div className="stat-value">{published}</div>
          <div className="stat-desc">{data.assignments.length} total</div>
        </div>
        <div className="stat">
          <div className="stat-title">Awaiting grading</div>
          <div className="stat-value text-warning">{totalPending}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Graded</div>
          <div className="stat-value text-success">{totalGraded}</div>
        </div>
      </div>

      <div>
        <h2 className="font-medium text-base-content mb-3">Assignment status breakdown</h2>
        {data.assignments.length === 0 && <p className="text-sm text-base-content/60">No assignments yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.assignments.map((a) => {
            const total = a.notSubmitted + a.pendingConfirmation + a.waitingForGrading + a.graded;
            const progress = total === 0 ? 0 : Math.round((a.graded / total) * 100);
            return (
              <div key={a.id} className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="card-title text-base">{a.title}</h3>
                    <span className="badge badge-sm badge-ghost capitalize">{a.assignmentStatus}</span>
                  </div>
                  <p className="text-xs text-base-content/60 mb-2">{courseTitle(a.courseId)}</p>
                  <progress className="progress progress-primary" value={progress} max="100" />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COUNT_BADGES.map(({ key, label, className }) => (
                      <span key={key} className={`badge badge-sm ${className}`}>
                        {a[key]} {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
