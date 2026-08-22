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

  const published = course.assignments.filter((a) => a.status === 'published');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-gray-900">{course.title}</h1>
        {course.description && <p className="text-sm text-gray-700 mt-1">{course.description}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Assignments</h2>
        {published.length === 0 && <p className="text-sm text-gray-500">No assignments yet.</p>}
        <ul className="space-y-2">
          {published.map((a) => (
            <li key={a.id}>
              <Link
                to={`/student/assignments/${a.id}`}
                className="block border border-gray-200 rounded-lg p-3 hover:border-gray-400 text-sm"
              >
                <span className="font-medium text-gray-900">{a.title}</span>
                <span className="text-gray-500"> — due {new Date(a.dueDate).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-medium text-gray-900 mb-3">Roster</h2>
        <ul className="space-y-1">
          {course.roster.map((s) => (
            <li key={s.id} className="text-sm text-gray-700">{s.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
