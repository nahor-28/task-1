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

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!course) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{course.title}</h1>
          {course.description && <p className="text-sm text-gray-700 mt-1">{course.description}</p>}
        </div>
        <Link to={`/educator/assignments/new?courseId=${id}`} className="bg-gray-900 text-white text-sm rounded px-4 py-2">
          New assignment
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Assignments</h2>
        {course.assignments.length === 0 && <p className="text-sm text-gray-500">No assignments yet.</p>}
        <ul className="space-y-2">
          {course.assignments.map((a) => (
            <li key={a.id}>
              <Link
                to={`/educator/assignments/${a.id}`}
                className="block border border-gray-200 rounded-lg p-3 hover:border-gray-400 text-sm"
              >
                <span className="font-medium text-gray-900">{a.title}</span>
                <span className="text-gray-500"> — {a.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Roster</h2>
        {course.roster.length === 0 && <p className="text-sm text-gray-500">No students enrolled yet.</p>}
        <ul className="space-y-1">
          {course.roster.map((s) => (
            <li key={s.id} className="text-sm text-gray-700">
              {s.name} <span className="text-gray-400">{s.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
