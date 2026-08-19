import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function Reports() {
  const { token, user } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/reports?studentId=${user.id}`, token)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [token, user.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!report) return null;

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h1>
      <p className="text-sm text-gray-600 mb-4">
        Completion rate: <span className="font-medium text-gray-900">{Math.round(report.completionRate * 100)}%</span>
      </p>
      <ul className="space-y-2">
        {report.assignments.map((a) => (
          <li key={a.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between text-sm">
            <span className="text-gray-700">{a.title}</span>
            <span className="text-gray-900 font-medium">{a.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
