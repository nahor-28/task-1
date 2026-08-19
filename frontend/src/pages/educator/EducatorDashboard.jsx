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

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Assignments</p>
          <p className="text-2xl font-semibold text-gray-900">{data.totalAssignments}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Students</p>
          <p className="text-2xl font-semibold text-gray-900">{data.totalStudents}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Avg completion</p>
          <p className="text-2xl font-semibold text-gray-900">{Math.round(data.avgCompletionRate * 100)}%</p>
        </div>
      </div>
      <h2 className="font-medium text-gray-900 mb-2">Group progress</h2>
      <ul className="space-y-2">
        {data.groupSummaries.map((g) => (
          <li key={g.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between text-sm">
            <span className="text-gray-700">{g.name}</span>
            <span className="text-gray-900 font-medium">{Math.round(g.completionRate * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
