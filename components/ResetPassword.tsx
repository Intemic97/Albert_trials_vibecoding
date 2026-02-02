import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowLeft, SpinnerGap, CheckCircle, XCircle, Key } from '@phosphor-icons/react';
import { API_BASE } from '../config';

export function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'submitting' | 'success'>('loading');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });

    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            setError('No reset token provided');
            return;
        }

        validateToken(token);
    }, [token]);

    const validateToken = async (token: string) => {
        try {
            const res = await fetch(`${API_BASE}/auth/validate-reset-token?token=${token}`, {
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid reset token');
            }

            setEmail(data.email);
            setStatus('valid');
        } catch (err: any) {
            setStatus('invalid');
            setError(err.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setStatus('submitting');

        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: formData.password
                }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setStatus('success');
        } catch (err: any) {
            setStatus('valid');
            setError(err.message);
        }
    };

    // Loading state
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#191919] flex flex-col">
                <div className="pt-8 pb-4 flex justify-center">
                    <img
                        src="/logo.svg"
                        alt="Intemic"
                        className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                    />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <SpinnerGap weight="bold" className="w-10 h-10 text-[#256A65] animate-spin mx-auto mb-4" />
                        <p className="text-[#9b9b9b] text-sm">Validating reset link...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Invalid token
    if (status === 'invalid') {
        return (
            <div className="min-h-screen bg-[#191919] flex flex-col">
                <div className="pt-8 pb-4 flex justify-center">
                    <img
                        src="/logo.svg"
                        alt="Intemic"
                        className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                    />
                </div>

                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-sm text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle weight="fill" className="w-8 h-8 text-red-400" />
                        </div>
                        <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Invalid or expired link
                        </h1>
                        <p className="text-[#9b9b9b] mb-6 text-sm">{error}</p>
                        <p className="text-[#6b6b6b] text-sm mb-8">
                            Password reset links expire after 1 hour. Please request a new one.
                        </p>
                        <div className="space-y-3">
                            <Link
                                to="/forgot-password"
                                className="w-full bg-[#256A65] hover:bg-[#1e5a55] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center text-sm"
                            >
                                Request new link
                            </Link>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#e8e8e8] font-medium py-3 rounded-lg transition-colors border border-[#404040] text-sm"
                            >
                                Back to sign in
                            </button>
                        </div>
                    </div>
                </div>

                <div className="py-6 text-center">
                    <p className="text-xs text-[#505050]">
                        © {new Date().getFullYear()} Intemic. All rights reserved.
                    </p>
                </div>
            </div>
        );
    }

    // Success state
    if (status === 'success') {
        return (
            <div className="min-h-screen bg-[#191919] flex flex-col">
                <div className="pt-8 pb-4 flex justify-center">
                    <img
                        src="/logo.svg"
                        alt="Intemic"
                        className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                    />
                </div>

                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-sm text-center">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle weight="fill" className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Password reset!
                        </h1>
                        <p className="text-[#9b9b9b] mb-8 text-sm">
                            Your password has been successfully updated. You can now sign in with your new password.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#256A65] hover:bg-[#1e5a55] text-white font-medium py-3 rounded-lg transition-colors text-sm"
                        >
                            Go to sign in
                        </button>
                    </div>
                </div>

                <div className="py-6 text-center">
                    <p className="text-xs text-[#505050]">
                        © {new Date().getFullYear()} Intemic. All rights reserved.
                    </p>
                </div>
            </div>
        );
    }

    // Reset form
    return (
        <div className="min-h-screen bg-[#191919] flex flex-col">
            <div className="pt-8 pb-4 flex justify-center">
                <img
                    src="/logo.svg"
                    alt="Intemic"
                    className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                />
            </div>

            <div className="flex-1 flex items-center justify-center px-4">
                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-14 h-14 bg-[#256A65]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Key weight="light" className="w-7 h-7 text-[#256A65]" />
                        </div>
                        <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Set new password
                        </h1>
                        <p className="text-[#9b9b9b] text-sm">
                            Create a new password for <span className="text-[#e8e8e8] font-medium">{email}</span>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <Lock weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="password"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#256A65] focus:ring-1 focus:ring-[#256A65] transition-all text-sm"
                                placeholder="New password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>

                        <div className="relative">
                            <Lock weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="password"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#256A65] focus:ring-1 focus:ring-[#256A65] transition-all text-sm"
                                placeholder="Confirm new password"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="w-full bg-[#256A65] hover:bg-[#1e5a55] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {status === 'submitting' ? (
                                <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                            ) : (
                                'Reset password'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            to="/login"
                            className="text-sm text-[#6b6b6b] hover:text-[#9b9b9b] transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft weight="bold" className="w-4 h-4" />
                            Back to sign in
                        </Link>
                    </div>
                </div>
            </div>

            <div className="py-6 text-center">
                <p className="text-xs text-[#505050]">
                    © {new Date().getFullYear()} Intemic. All rights reserved.
                </p>
            </div>
        </div>
    );
}
