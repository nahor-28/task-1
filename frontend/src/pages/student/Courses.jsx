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
  const [loaded, setLoaded] = useState(false);
  const [enrollingId, setEnrollingId] = useState(null);

  async function load() {
    const [m, b] = await Promise.all([api.get('/courses/mine', token), api.get('/courses', token)]);
    setMine(m);
    setBrowse(b);
    setLoaded(true);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function enroll(id) {
    setEnrollingId(id);
    try {
      await api.post(`/courses/${id}/enroll`, undefined, token);
      toast.success('Enrolled.');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnrollingId(null);
    }
  }

  const mineIds = new Set(mine.map((c) => c.id));
  const available = browse.filter((c) => !mineIds.has(c.id));

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-box" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-base-content mb-4">Your courses</h1>
        {mine.length === 0 && <p className="text-sm text-base-content/60">Not enrolled in any courses yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {mine.map((c) => (
            <Link
              key={c.id}
              to={`/student/courses/${c.id}`}
              className="card bg-base-100 shadow-sm border border-base-300 transition-shadow hover:shadow-md"
            >
              <div className="card-body">
                <h3 className="card-title text-base">{c.title}</h3>
                {c.description && <p className="text-sm text-base-content/60 line-clamp-2">{c.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-medium text-base-content mb-3">Browse courses</h2>
        {available.length === 0 && <p className="text-sm text-base-content/60">No other courses available.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {available.map((c) => (
            <div key={c.id} className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body">
                <h3 className="card-title text-base">{c.title}</h3>
                {c.description && <p className="text-sm text-base-content/60 line-clamp-2">{c.description}</p>}
                <div className="card-actions justify-end mt-2">
                  <button onClick={() => enroll(c.id)} disabled={enrollingId === c.id} className="btn btn-primary btn-sm">
                    {enrollingId === c.id && <span className="loading loading-spinner loading-xs" />}
                    Enroll
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
