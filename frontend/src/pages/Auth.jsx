import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api/client.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'educator' ? '/educator/dashboard' : '/student/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input validator w-full"
          placeholder="you@example.com"
        />
        <p className="validator-hint">Enter a valid email address</p>
      </div>
      <div>
        <label className="label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input validator w-full"
          placeholder="••••••••"
        />
        <p className="validator-hint">Password is required</p>
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
        {loading && <span className="loading loading-spinner loading-sm" />}
        {loading ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}

function RegisterForm() {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student' });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { name: form.name, email: form.email, password: form.password, role: form.role });
      setDone(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-1.243-1.007-2.25-2.25-2.25H5.25C4.007 6 3 7.007 3 8.25m18 0v7.5c0 1.243-1.007 2.25-2.25 2.25H5.25A2.25 2.25 0 013 15.75v-7.5m18 0l-9 6.75L3 8.25" />
          </svg>
        </div>
        <h2 className="font-semibold text-base-content mb-1">Check your email</h2>
        <p className="text-sm text-base-content/60">We sent a verification link to {form.email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="reg-role">I'm a</label>
        <div className="join w-full" id="reg-role">
          <button
            type="button"
            className={`btn join-item flex-1 ${form.role === 'student' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setForm({ ...form, role: 'student' })}
          >
            Student
          </button>
          <button
            type="button"
            className={`btn join-item flex-1 ${form.role === 'educator' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setForm({ ...form, role: 'educator' })}
          >
            Educator
          </button>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="reg-name">Name</label>
        <input id="reg-name" required value={form.name} onChange={update('name')} className="input validator w-full" />
        <p className="validator-hint">Name is required</p>
      </div>
      <div>
        <label className="label" htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          required
          value={form.email}
          onChange={update('email')}
          className="input validator w-full"
          placeholder="you@example.com"
        />
        <p className="validator-hint">Enter a valid email address</p>
      </div>
      <div>
        <label className="label" htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update('password')}
          className="input validator w-full"
          placeholder="At least 8 characters"
        />
        <p className="validator-hint">Password must be at least 8 characters</p>
      </div>
      <div>
        <label className="label" htmlFor="reg-confirm">Confirm password</label>
        <input
          id="reg-confirm"
          type="password"
          required
          pattern={form.password ? escapeRegExp(form.password) : undefined}
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          className="input validator w-full"
          placeholder="Re-enter password"
        />
        <p className="validator-hint">Passwords must match</p>
      </div>
      <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
        {loading && <span className="loading loading-spinner loading-sm" />}
        {loading ? 'Creating account...' : 'Register'}
      </button>
    </form>
  );
}

export function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === '/register' ? 'register' : 'login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <span className="text-lg font-semibold text-base-content text-center mb-4">Assignment Tracker</span>
          <div role="tablist" className="tabs tabs-box mb-6">
            <button
              role="tab"
              type="button"
              className={`tab flex-1 ${mode === 'login' ? 'tab-active' : ''}`}
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
            <button
              role="tab"
              type="button"
              className={`tab flex-1 ${mode === 'register' ? 'tab-active' : ''}`}
              onClick={() => navigate('/register')}
            >
              Register
            </button>
          </div>
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
}
