import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    api
      .get(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('verified'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 w-full max-w-sm text-center">
        {status === 'verifying' && <p className="text-sm text-gray-600">Verifying...</p>}
        {status === 'verified' && (
          <>
            <h1 className="text-xl font-semibold mb-2 text-gray-900">Email verified</h1>
            <Link to="/login" className="text-sm text-gray-900 underline">Continue to log in</Link>
          </>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">This verification link is invalid or expired.</p>
        )}
      </div>
    </div>
  );
}
