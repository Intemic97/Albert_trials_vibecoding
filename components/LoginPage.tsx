import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Building2, Mail, Lock, ArrowRight, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { API_BASE } from '../config';

export function LoginPage() {
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showVerificationMessage, setShowVerificationMessage] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        orgName: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setShowVerificationMessage(false);
        setResendSuccess(false);

        const endpoint = isLogin ? '/auth/login' : '/auth/register';

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                // Check if this is a verification required error
                if (data.requiresVerification) {
                    setShowVerificationMessage(true);
                    setVerificationEmail(data.email || formData.email);
                    return;
                }
                throw new Error(data.error || 'Authentication failed');
            }

            // Check if registration requires verification
            if (data.requiresVerification) {
                setShowVerificationMessage(true);
                setVerificationEmail(formData.email);
                return;
            }

            login(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setIsResending(true);
        setError('');
        setResendSuccess(false);

        try {
            const res = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: verificationEmail }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to resend verification email');
            }

            setResendSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsResending(false);
        }
    };

    // Show verification message screen
    if (showVerificationMessage) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="flex items-center justify-center mx-auto mb-6">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                <Mail className="w-8 h-8 text-emerald-400" />
                            </div>
                        </div>
                        
                        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
                        <p className="text-slate-400 mb-6">
                            We've sent a verification link to<br />
                            <span className="text-white font-medium">{verificationEmail}</span>
                        </p>
                        
                        <p className="text-sm text-slate-500 mb-6">
                            Click the link in the email to verify your account and start using Intemic.
                        </p>

                        {resendSuccess && (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400 mb-4 flex items-center gap-2 justify-center">
                                <CheckCircle className="w-4 h-4" />
                                Verification email sent!
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 mb-4">
                                {error}
                            </div>
                        )}
                        
                        <button
                            onClick={handleResendVerification}
                            disabled={isResending}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                        >
                            {isResending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Resend verification email
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={() => {
                                setShowVerificationMessage(false);
                                setIsLogin(true);
                                setError('');
                                setResendSuccess(false);
                            }}
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center mx-auto mb-4">
                            <img
                                src="/logo.png"
                                alt="Intemic"
                                className="h-10 w-auto object-contain"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {isLogin ? 'Welcome back' : 'Create an organization'}
                        </h1>
                        <p className="text-slate-400">
                            {isLogin
                                ? 'Enter your credentials to access your workspace'
                                : 'Get started with your own secure workspace'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Full Name</label>
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
                                    <label className="text-sm font-medium text-slate-300">Organization Name</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                            placeholder="Acme Inc."
                                            value={formData.orgName}
                                            onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="name@company.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Password</label>
                                {isLogin && (
                                    <Link 
                                        to="/forgot-password" 
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
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

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
