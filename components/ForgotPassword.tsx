import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Envelope, ArrowLeft, SpinnerGap, CheckCircle } from '@phosphor-icons/react';
import { API_BASE } from '../config';

export function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setStatus('loading');

        try {
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send reset email');
            }

            setStatus('success');
        } catch (err: any) {
            setStatus('error');
            setError(err.message);
        }
    };

    // Success state
    if (status === 'success') {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-[var(--bg-selected)]/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle weight="light" className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-normal text-white mb-2">Check your email</h1>
                        <p className="text-slate-400 mb-6">
                            If an account exists for <span className="text-white font-medium">{email}</span>, 
                            you'll receive an email with a link to reset your password.
                        </p>
                        <p className="text-[var(--text-secondary)] text-sm mb-6">
                            The link will expire in 1 hour.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft weight="light" className="w-4 h-4" />
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-[var(--bg-selected)]/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Envelope weight="light" className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-normal text-white mb-2">Forgot your password?</h1>
                        <p className="text-slate-400">
                            No worries! Enter your email and we'll send you a reset link.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Email address</label>
                            <div className="relative">
                                <Envelope weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'loading' ? (
                                <SpinnerGap weight="light" className="w-5 h-5 animate-spin" />
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            to="/login"
                            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft weight="light" className="w-4 h-4" />
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

