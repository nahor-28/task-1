import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

function courseProgress(assignments) {
  if (assignments.length === 0) return 0;
  const graded = assignments.filter((a) => a.status === 'graded').length;
  return Math.round((graded / assignments.length) * 100);
}

export function StudentDashboard() {
  const { token, user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [dueDates, setDueDates] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/reports/dashboard', token), api.get('/assignments', token)])
      .then(([dash, list]) => {
        setDashboard(dash);
        setDueDates(Object.fromEntries(list.map((a) => [a.id, a.dueDate])));
      })
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <div className="alert alert-error"><span>{error}</span></div>;

  if (!dashboard) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-box" />
        ))}
      </div>
    );
  }

  const { courses, assignments, completionRate } = dashboard;
  const gradedCount = assignments.filter((a) => a.status === 'graded').length;
  const pendingCount = assignments.filter((a) => a.status !== 'graded').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-base-content">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-base-content/60">Here's where things stand across your courses.</p>
      </div>

      <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
        <div className="stat">
          <div className="stat-title">Courses</div>
          <div className="stat-value text-primary">{courses.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Assignments</div>
          <div className="stat-value">{assignments.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Graded</div>
          <div className="stat-value text-success">{gradedCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Pending</div>
          <div className="stat-value text-warning">{pendingCount}</div>
          <div className="stat-desc">{Math.round(completionRate * 100)}% complete overall</div>
        </div>
      </div>

      <div>
        <h2 className="font-medium text-base-content mb-3">Your courses</h2>
        {courses.length === 0 && <p className="text-sm text-base-content/60">Not enrolled in any courses yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => {
            const courseAssignments = assignments.filter((a) => a.courseId === c.id);
            const progress = courseProgress(courseAssignments);
            return (
              <Link
                key={c.id}
                to={`/student/courses/${c.id}`}
                className="card bg-base-100 shadow-sm border border-base-300 transition-shadow hover:shadow-md"
              >
                <div className="card-body">
                  <h3 className="card-title text-base">{c.title}</h3>
                  <p className="text-xs text-base-content/60 mb-2">
                    {courseAssignments.length} assignment{courseAssignments.length === 1 ? '' : 's'}
                  </p>
                  <progress className="progress progress-primary" value={progress} max="100" />
                  <p className="text-xs text-base-content/60 mt-1">{progress}% graded</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-medium text-base-content mb-3">Assignments</h2>
        {assignments.length === 0 && <p className="text-sm text-base-content/60">No assignments yet.</p>}
        <ul className="flex flex-col gap-2">
          {assignments.map((a) => (
            <li key={a.id}>
              <Link
                to={`/student/assignments/${a.id}`}
                className="flex items-center justify-between gap-4 bg-base-100 border border-base-300 rounded-box p-4 transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="font-medium text-base-content">{a.title}</p>
                  {dueDates[a.id] && (
                    <p className="text-xs text-base-content/60">Due {new Date(dueDates[a.id]).toLocaleDateString()}</p>
                  )}
                </div>
                <StatusBadge status={a.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
