import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Envelope, Lock, User, ArrowRight, SpinnerGap, Users, CheckCircle, XCircle } from '@phosphor-icons/react';
import { API_BASE } from '../config';

interface InvitationInfo {
    email: string;
    organizationName: string;
    invitedByName: string;
}

export function AcceptInvite() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'registering' | 'success'>('loading');
    const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        name: '',
        password: '',
        confirmPassword: ''
    });

    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            setError('No invitation token provided');
            return;
        }

        validateInvitation(token);
    }, [token]);

    const validateInvitation = async (token: string) => {
        try {
            const res = await fetch(`${API_BASE}/auth/validate-invitation?token=${token}`, {
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid invitation');
            }

            setInvitation(data);
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

        setStatus('registering');

        try {
            const res = await fetch(`${API_BASE}/auth/register-with-invitation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: invitation?.email,
                    password: formData.password,
                    name: formData.name,
                    token
                }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            setStatus('success');
            
            setTimeout(() => {
                login(data.user);
                navigate('/overview');
            }, 2000);

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
                        <SpinnerGap weight="bold" className="w-10 h-10 text-[var(--accent-primary)] animate-spin mx-auto mb-4" />
                        <p className="text-[#9b9b9b] text-sm">Validating invitation...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Invalid invitation
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
                            Invalid invitation
                        </h1>
                        <p className="text-[#9b9b9b] text-sm mb-8">{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#e8e8e8] font-medium py-3 rounded-lg transition-colors border border-[#404040] text-sm"
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
                            Welcome to the team!
                        </h1>
                        <p className="text-[#9b9b9b] text-sm mb-2">
                            You've successfully joined <span className="text-[#e8e8e8] font-medium">{invitation?.organizationName}</span>
                        </p>
                        <p className="text-[#6b6b6b] text-sm">Redirecting you to the dashboard...</p>
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

    // Registration form
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
                        <div className="w-14 h-14 bg-[var(--accent-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users weight="light" className="w-7 h-7 text-[var(--accent-primary)]" />
                        </div>
                        <h1 className="text-xl font-medium text-[#e8e8e8] mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Join {invitation?.organizationName}
                        </h1>
                        <p className="text-[#9b9b9b] text-sm">
                            <span className="text-[#e8e8e8]">{invitation?.invitedByName}</span> has invited you to join their team
                        </p>
                    </div>

                    {/* Email display */}
                    <div className="mb-6 p-3 bg-[#2f2f2f] rounded-lg border border-[#404040]">
                        <p className="text-xs text-[#6b6b6b] mb-1">You're signing up as</p>
                        <p className="text-[#e8e8e8] font-medium flex items-center gap-2 text-sm">
                            <Envelope weight="light" className="w-4 h-4 text-[#6b6b6b]" />
                            {invitation?.email}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <User weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="text"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                placeholder="Your full name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="relative">
                            <Lock weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="password"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                placeholder="Password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>

                        <div className="relative">
                            <Lock weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="password"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                placeholder="Confirm password"
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
                            disabled={status === 'registering'}
                            className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {status === 'registering' ? (
                                <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Join team
                                    <ArrowRight weight="bold" className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm text-[#6b6b6b] hover:text-[#9b9b9b] transition-colors"
                        >
                            Already have an account? Sign in
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
