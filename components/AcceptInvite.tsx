import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, ArrowRight, Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
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
            
            // Auto-login after short delay
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Validating invitation...</p>
                </div>
            </div>
        );
    }

    // Invalid invitation
    if (status === 'invalid') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-normal text-white mb-2">Invalid Invitation</h1>
                        <p className="text-slate-400 mb-6">{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors"
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Success state
    if (status === 'success') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-normal text-white mb-2">Welcome to the team!</h1>
                        <p className="text-slate-400 mb-2">
                            You've successfully joined <span className="text-white font-medium">{invitation?.organizationName}</span>
                        </p>
                        <p className="text-slate-500 text-sm">Redirecting you to the dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Registration form
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-normal text-white mb-2">Join {invitation?.organizationName}</h1>
                        <p className="text-slate-400">
                            <span className="text-white">{invitation?.invitedByName}</span> has invited you to join their team
                        </p>
                    </div>

                    {/* Email display */}
                    <div className="mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-500 mb-1">You're signing up as</p>
                        <p className="text-white font-medium flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {invitation?.email}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Your Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="John Doe"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                            disabled={status === 'registering'}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'registering' ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Join Team
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Already have an account? Sign in
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

