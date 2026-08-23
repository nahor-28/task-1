import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function CourseDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/courses/${id}`, token).then(setCourse).catch((err) => setError(err.message));
  }, [id, token]);

  if (error) return <div className="alert alert-error"><span>{error}</span></div>;

  if (!course) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-20 rounded-box" />
        <div className="skeleton h-40 rounded-box" />
        <div className="skeleton h-32 rounded-box" />
      </div>
    );
  }

  const published = course.assignments.filter((a) => a.status === 'published');

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <h1 className="card-title">{course.title}</h1>
          {course.description && <p className="text-sm text-base-content/70">{course.description}</p>}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <h2 className="font-medium text-base-content mb-3">Assignments</h2>
          {published.length === 0 && <p className="text-sm text-base-content/60">No assignments yet.</p>}
          <ul className="flex flex-col gap-2">
            {published.map((a) => {
              const overdue = new Date(a.dueDate) < new Date();
              return (
                <li key={a.id}>
                  <Link
                    to={`/student/assignments/${a.id}`}
                    className="flex items-center justify-between gap-4 border border-base-300 rounded-box p-3 transition-colors hover:border-primary/40"
                  >
                    <span className="font-medium text-base-content text-sm">{a.title}</span>
                    <span className="flex items-center gap-2 text-xs text-base-content/60">
                      Due {new Date(a.dueDate).toLocaleDateString()}
                      {overdue && <span className="badge badge-error badge-soft badge-sm">Overdue</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <h2 className="font-medium text-base-content mb-3">Roster</h2>
          {course.roster.length === 0 && <p className="text-sm text-base-content/60">No students enrolled yet.</p>}
          <ul className="flex flex-col gap-1">
            {course.roster.map((s) => (
              <li key={s.id} className="text-sm text-base-content/80">{s.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
