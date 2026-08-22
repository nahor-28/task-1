import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function EducatorDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard', token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const courseTitle = (courseId) => data.courses.find((c) => c.id === courseId)?.title;

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Courses taught</p>
          <p className="text-2xl font-semibold text-gray-900">{data.courses.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Assignments</p>
          <p className="text-2xl font-semibold text-gray-900">{data.assignments.length}</p>
        </div>
      </div>

      <h2 className="font-medium text-gray-900 mb-2">Assignment status breakdown</h2>
      <ul className="space-y-2">
        {data.assignments.map((a) => (
          <li key={a.id} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900">{a.title}</span>
              <span className="text-gray-500">
                {courseTitle(a.courseId)} · {a.assignmentStatus}
              </span>
            </div>
            <div className="text-gray-600">
              Not submitted {a.notSubmitted} · Pending {a.pendingConfirmation} · Waiting for grading{' '}
              {a.waitingForGrading} · Graded {a.graded}
            </div>
          </li>
        ))}
        {data.assignments.length === 0 && <p className="text-sm text-gray-500">No assignments yet.</p>}
      </ul>
    </div>
  );
}
