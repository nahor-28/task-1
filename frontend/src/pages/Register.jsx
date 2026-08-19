import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2 text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-600">We sent a verification link to {form.email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-gray-900">Register</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <label className="block text-sm text-gray-600 mb-1">Name</label>
        <input required value={form.name} onChange={update('name')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
        <label className="block text-sm text-gray-600 mb-1">Email</label>
        <input type="email" required value={form.email} onChange={update('email')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
        <label className="block text-sm text-gray-600 mb-1">Password</label>
        <input type="password" required value={form.password} onChange={update('password')} className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm" />
        <label className="block text-sm text-gray-600 mb-1">Role</label>
        <select value={form.role} onChange={update('role')} className="w-full border border-gray-300 rounded px-3 py-2 mb-6 text-sm">
          <option value="student">Student</option>
          <option value="educator">Educator</option>
        </select>
        <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white rounded py-2 text-sm font-medium disabled:opacity-50">
          {loading ? 'Creating account...' : 'Register'}
        </button>
        <p className="text-sm text-gray-500 mt-4 text-center">
          Already have an account? <Link to="/login" className="text-gray-900 underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
