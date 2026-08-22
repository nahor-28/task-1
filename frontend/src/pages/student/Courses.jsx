import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function Courses() {
  const { token } = useAuth();
  const toast = useToast();
  const [mine, setMine] = useState([]);
  const [browse, setBrowse] = useState([]);

  async function load() {
    const [m, b] = await Promise.all([api.get('/courses/mine', token), api.get('/courses', token)]);
    setMine(m);
    setBrowse(b);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function enroll(id) {
    try {
      await api.post(`/courses/${id}/enroll`, undefined, token);
      toast.success('Enrolled.');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const mineIds = new Set(mine.map((c) => c.id));
  const available = browse.filter((c) => !mineIds.has(c.id));

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Your Courses</h1>
      <ul className="space-y-2 mb-8">
        {mine.map((c) => (
          <li key={c.id}>
            <Link
              to={`/student/courses/${c.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
            >
              <p className="font-medium text-gray-900">{c.title}</p>
              {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
            </Link>
          </li>
        ))}
        {mine.length === 0 && <p className="text-sm text-gray-500">Not enrolled in any courses yet.</p>}
      </ul>

      <h2 className="font-medium text-gray-900 mb-2">Browse courses</h2>
      <ul className="space-y-2">
        {available.map((c) => (
          <li key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{c.title}</p>
              {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
            </div>
            <button onClick={() => enroll(c.id)} className="bg-gray-900 text-white text-sm rounded px-4 py-2">
              Enroll
            </button>
          </li>
        ))}
        {available.length === 0 && <p className="text-sm text-gray-500">No other courses available.</p>}
      </ul>
    </div>
  );
}
