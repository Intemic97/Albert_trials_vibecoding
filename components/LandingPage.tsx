import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Loader2, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../config';

export function LandingPage() {
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showVerificationMessage, setShowVerificationMessage] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        orgName: ''
    });

    const parseResponse = async (res: Response) => {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                return await res.json();
            } catch (error) {
                return { error: 'Respuesta JSON invalida del servidor.' };
            }
        }
        const text = await res.text();
        return text ? { error: text } : { error: 'Respuesta vacia del servidor.' };
    };

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

            const data = await parseResponse(res);

            if (!res.ok) {
                if (data.requiresVerification) {
                    setShowVerificationMessage(true);
                    setVerificationEmail(data.email || formData.email);
                    return;
                }
                throw new Error(data.error || 'Authentication failed');
            }

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

    const handleGoogleAuth = () => {
        window.location.href = `${API_BASE}/auth/google`;
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

            const data = await parseResponse(res);

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
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-lg p-8">
                        <div className="flex items-center justify-center mx-auto mb-6">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                <Mail className="w-8 h-8 text-slate-700" />
                            </div>
                        </div>
                        
                        <h1 className="text-2xl font-normal text-slate-900 text-center mb-2">Check your email</h1>
                        <p className="text-slate-600 text-center mb-6">
                            We've sent a verification link to<br />
                            <span className="text-slate-900 font-medium">{verificationEmail}</span>
                        </p>
                        
                        <p className="text-sm text-slate-500 text-center mb-6">
                            Click the link in the email to verify your account and start using Intemic.
                        </p>

                        {resendSuccess && (
                            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 mb-4 flex items-center gap-2 justify-center">
                                <CheckCircle className="w-4 h-4" />
                                Verification email sent!
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
                                {error}
                            </div>
                        )}
                        
                        <button
                            onClick={handleResendVerification}
                            disabled={isResending}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
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
                            className="w-full text-sm text-slate-600 hover:text-slate-800 transition-colors"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
            {/* Logo */}
            <div className="mb-8">
                <img
                    src="/logo.svg"
                    alt="Intemic"
                    className="h-8 w-auto object-contain"
                />
            </div>

            {/* Title */}
            <h1 className="text-xl font-normal text-slate-900 mb-2 text-center" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                Create your Intemic account
            </h1>
            <p className="text-base text-slate-600 mb-8 text-center max-w-md">
                Join us today and transform the way you manage your data and automate workflows!
            </p>

            {/* Form Card */}
            <div className="w-full max-w-md">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 transition-all"
                                        placeholder="Jon Snow"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 transition-all"
                                        placeholder="jon@winterfell.com"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Workspace Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 transition-all"
                                        placeholder="Acme Inc."
                                        value={formData.orgName}
                                        onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 transition-all"
                                        placeholder="name@company.com"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-semibold text-slate-900">Password</label>
                                        <Link 
                                            to="/forgot-password" 
                                            className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                                        >
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 transition-all"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isLogin ? 'Sign in' : 'Create account'
                            )}
                        </button>
                    </form>

                    {!isLogin && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-slate-500">Or</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleAuth}
                                className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                Continue with Google
                            </button>
                        </>
                    )}
                </div>

                {/* Footer Links */}
                <div className="mt-8 text-center text-sm text-slate-600">
                    <p className="mb-4">
                        If you have any problem or suggestion check our{' '}
                        <Link to="/documentation" className="text-slate-900 hover:underline font-medium">
                            documentation
                        </Link>
                        {' '}or contact us via{' '}
                        <a href="mailto:support@intemic.com" className="text-slate-900 hover:underline font-medium">
                            email
                        </a>
                        {' '}or{' '}
                        <a href="https://slack.intemic.com" className="text-slate-900 hover:underline font-medium">
                            Slack
                        </a>
                        .
                    </p>
                    {isLogin ? (
                        <p>
                            Don't have an account?{' '}
                            <button
                                onClick={() => setIsLogin(false)}
                                className="text-slate-900 hover:underline font-medium"
                            >
                                Sign up →
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button
                                onClick={() => setIsLogin(true)}
                                className="text-slate-900 hover:underline font-medium"
                            >
                                Log in →
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
