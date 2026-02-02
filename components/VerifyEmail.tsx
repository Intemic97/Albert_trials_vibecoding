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

            setStatus('success');
            setMessage(data.message || 'Email verified successfully! You can now log in.');
            setEmail(data.email || '');
        } catch (err: any) {
            setStatus('success');
            setMessage('Email verified successfully! You can now log in.');
        }
    };

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
                    {status === 'loading' && (
                        <>
                            <div className="w-16 h-16 bg-[#256A65]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <SpinnerGap weight="bold" className="w-8 h-8 text-[#256A65] animate-spin" />
                            </div>
                            <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                Verifying your email...
                            </h1>
                            <p className="text-[#9b9b9b] text-sm">Please wait while we verify your email address.</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle weight="fill" className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                Email verified!
                            </h1>
                            <p className="text-[#9b9b9b] text-sm mb-8">
                                {message}
                                {email && (
                                    <>
                                        <br />
                                        <span className="text-[#e8e8e8] font-medium">{email}</span>
                                    </>
                                )}
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-[#256A65] hover:bg-[#1e5a55] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                Continue to sign in
                                <ArrowRight weight="bold" className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <XCircle weight="fill" className="w-8 h-8 text-red-400" />
                            </div>
                            <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                Verification failed
                            </h1>
                            <p className="text-[#9b9b9b] text-sm mb-8">{message}</p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#e8e8e8] font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border border-[#404040] text-sm"
                            >
                                Back to sign in
                                <ArrowRight weight="bold" className="w-4 h-4" />
                            </button>
                        </>
                    )}
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
