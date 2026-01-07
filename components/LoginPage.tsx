import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Loader2, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
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
    const [showPassword, setShowPassword] = useState(false);

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
            <div className="min-h-screen bg-[#dde1e7] flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-xl p-8 shadow-sm">
                        <div className="flex items-center justify-center mx-auto mb-6">
                            <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center">
                                <Mail className="w-8 h-8 text-[#1e3a5f]" />
                            </div>
                        </div>
                        
                        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Check your email</h1>
                        <p className="text-gray-500 text-center mb-6">
                            We've sent a verification link to<br />
                            <span className="text-gray-900 font-medium">{verificationEmail}</span>
                        </p>
                        
                        <p className="text-sm text-gray-400 text-center mb-6">
                            Click the link in the email to verify your account and start using Intemic.
                        </p>

                        {resendSuccess && (
                            <div className="p-3 bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 rounded-lg text-sm text-[#1e3a5f] mb-4 flex items-center gap-2 justify-center">
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
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
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
                            className="w-full text-sm text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#dde1e7] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-xl p-8 shadow-sm">
                    {/* Logo */}
                    <div className="mb-8">
                        <img
                            src="/logo.png"
                            alt="Intemic"
                            className="h-8 w-auto object-contain"
                        />
                    </div>

                    {/* Title */}
                    <div className="mb-6">
                        <h1 className="text-xl font-semibold text-gray-900 mb-1">
                            {isLogin ? 'Sign in to your account' : 'Create your account'}
                        </h1>
                        <p className="text-sm text-[#1e3a5f]">
                            {isLogin ? (
                                <>Don't have an account? <button onClick={() => setIsLogin(false)} className="font-medium hover:underline">Sign up</button></>
                            ) : (
                                <>Already have an account? <button onClick={() => setIsLogin(true)} className="font-medium hover:underline">Sign in</button></>
                            )}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-lg py-2.5 px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-lg py-2.5 px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                        placeholder="Acme Inc."
                                        value={formData.orgName}
                                        onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full bg-white border border-gray-200 rounded-lg py-2.5 px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                placeholder="name@company.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                {isLogin && (
                                    <Link 
                                        to="/forgot-password" 
                                        className="text-xs text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full bg-white border border-gray-200 rounded-lg py-2.5 px-4 pr-10 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isLogin ? 'Sign in' : 'Create account'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
