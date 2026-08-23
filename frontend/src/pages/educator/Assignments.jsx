import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function Assignments() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/assignments', token)
      .then((a) => {
        setAssignments(a);
        setLoaded(true);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-base-content">Your Assignments</h1>
        <Link to="/educator/assignments/new" className="btn btn-primary">
          New assignment
        </Link>
      </div>
      {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}

      {!loaded && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-box" />
          ))}
        </div>
      )}

      {loaded && assignments.length === 0 && <p className="text-sm text-base-content/60">No assignments yet.</p>}

      {loaded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <Link
              key={a.id}
              to={`/educator/assignments/${a.id}`}
              className="card bg-base-100 shadow-sm border border-base-300 transition-shadow hover:shadow-md"
            >
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="card-title text-base">{a.title}</h3>
                  <span className="badge badge-sm badge-ghost capitalize">{a.status}</span>
                </div>
                <p className="text-sm text-base-content/60">Due {new Date(a.dueDate).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
