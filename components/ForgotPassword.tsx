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
            <div className="min-h-screen bg-[#191919] flex flex-col">
                {/* Logo Header */}
                <div className="pt-8 pb-4 flex justify-center">
                    <img
                        src="/logo.svg"
                        alt="Intemic"
                        className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-sm text-center">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle weight="fill" className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Check your email
                        </h1>
                        <p className="text-[#9b9b9b] mb-6 text-sm">
                            If an account exists for <span className="text-[#e8e8e8] font-medium">{email}</span>, 
                            you'll receive an email with a link to reset your password.
                        </p>
                        <p className="text-[#6b6b6b] text-sm mb-8">
                            The link will expire in 1 hour.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#e8e8e8] font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border border-[#404040]"
                        >
                            <ArrowLeft weight="bold" className="w-4 h-4" />
                            Back to sign in
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="py-6 text-center">
                    <p className="text-xs text-[#505050]">
                        © {new Date().getFullYear()} Intemic. All rights reserved.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#191919] flex flex-col">
            {/* Logo Header */}
            <div className="pt-8 pb-4 flex justify-center">
                <img
                    src="/logo.svg"
                    alt="Intemic"
                    className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                />
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center px-4">
                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-14 h-14 bg-[#256A65]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Envelope weight="light" className="w-7 h-7 text-[#256A65]" />
                        </div>
                        <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Forgot password?
                        </h1>
                        <p className="text-[#9b9b9b] text-sm">
                            No worries! Enter your email and we'll send you a reset link.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <Envelope weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="email"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#256A65] focus:ring-1 focus:ring-[#256A65] transition-all text-sm"
                                placeholder="Enter your email address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-[#256A65] hover:bg-[#1e5a55] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {status === 'loading' ? (
                                <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                            ) : (
                                'Send reset link'
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

            {/* Footer */}
            <div className="py-6 text-center">
                <p className="text-xs text-[#505050]">
                    © {new Date().getFullYear()} Intemic. All rights reserved.
                </p>
            </div>
        </div>
    );
}
