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
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body text-center">
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <span className="loading loading-spinner loading-md text-primary" />
              <p className="text-sm text-base-content/60">Verifying...</p>
            </div>
          )}
          {status === 'verified' && (
            <>
              <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-base-content mb-2">Email verified</h1>
              <Link to="/login" className="btn btn-primary btn-sm">Continue to log in</Link>
            </>
          )}
          {status === 'error' && (
            <div className="alert alert-error alert-soft">
              <span className="text-sm">This verification link is invalid or expired.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
