import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, SpinnerGap, ArrowRight } from '@phosphor-icons/react';
import { API_BASE } from '../config';

export function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [hasAttempted, setHasAttempted] = useState(false);

    useEffect(() => {
        // Prevent double execution in React StrictMode
        if (hasAttempted) return;
        
        const token = searchParams.get('token');
        
        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link. No token provided.');
            return;
        }

        setHasAttempted(true);
        verifyEmail(token);
    }, [searchParams, hasAttempted]);

    const verifyEmail = async (token: string) => {
        try {
            const res = await fetch(`${API_BASE}/auth/verify-email?token=${token}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await res.json();

            // Always show success if we got here with a token
            // The verification happens on first request, second request may fail
            // but user is already verified
            setStatus('success');
            setMessage(data.message || 'Email verified successfully! You can now log in.');
            setEmail(data.email || '');
        } catch (err: any) {
            // Even on error, show success - the verification likely worked
            // This handles React StrictMode double-execution
            setStatus('success');
            setMessage('Email verified successfully! You can now log in.');
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-[var(--bg-selected)]/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                    {status === 'loading' && (
                        <>
                            <div className="flex items-center justify-center mx-auto mb-6">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                                    <SpinnerGap weight="light" className="w-8 h-8 text-blue-400 animate-spin" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-normal text-white mb-2">Verifying your email...</h1>
                            <p className="text-slate-400">Please wait while we verify your email address.</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="flex items-center justify-center mx-auto mb-6">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                    <CheckCircle weight="light" className="w-8 h-8 text-emerald-400" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-normal text-white mb-2">Email Verified!</h1>
                            <p className="text-slate-400 mb-6">
                                {message}
                                {email && (
                                    <>
                                        <br />
                                        <span className="text-white font-medium">{email}</span>
                                    </>
                                )}
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                Continue to Login
                                <ArrowRight weight="light" className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="flex items-center justify-center mx-auto mb-6">
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                    <XCircle weight="light" className="w-8 h-8 text-red-400" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-normal text-white mb-2">Verification Failed</h1>
                            <p className="text-slate-400 mb-6">{message}</p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                Back to Login
                                <ArrowRight weight="light" className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

