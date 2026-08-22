import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function Assignments() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/assignments', token).then(setAssignments).catch((err) => setError(err.message));
  }, [token]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Your Assignments</h1>
        <Link to="/educator/assignments/new" className="bg-gray-900 text-white text-sm rounded px-4 py-2">
          New assignment
        </Link>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {assignments.map((a) => (
          <li key={a.id}>
            <Link
              to={`/educator/assignments/${a.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
            >
              <p className="font-medium text-gray-900">{a.title}</p>
              <p className="text-sm text-gray-500">Due {new Date(a.dueDate).toLocaleDateString()} · {a.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
