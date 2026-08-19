import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function StudentDashboard() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/assignments', token).then(setAssignments).catch((err) => setError(err.message));
  }, [token]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Your Assignments</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {assignments.length === 0 && !error && (
        <p className="text-sm text-gray-500">No assignments yet.</p>
      )}
      <ul className="space-y-2">
        {assignments.map((a) => (
          <li key={a.id}>
            <Link
              to={`/student/assignments/${a.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
            >
              <p className="font-medium text-gray-900">{a.title}</p>
              <p className="text-sm text-gray-500">Due {new Date(a.dueDate).toLocaleDateString()}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
