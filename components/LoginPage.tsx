import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Envelope, SpinnerGap, CheckCircle, ArrowClockwise, Eye, EyeSlash } from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { logger } from '../utils/logger';
import { handleError, ApiError } from '../utils/errorHandler';

interface FormData {
    email: string;
    password: string;
    name: string;
    orgName: string;
}

interface ApiResponse {
    error?: string;
    requiresVerification?: boolean;
    email?: string;
    user?: unknown;
}

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

    const [formData, setFormData] = useState<FormData>({
        email: '',
        password: '',
        name: '',
        orgName: ''
    });

    const parseResponse = async (res: Response): Promise<ApiResponse> => {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            try {
                return await res.json();
            } catch (error) {
                logger.error('Failed to parse JSON response', error);
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
            logger.debug('Submitting authentication form', { endpoint, email: formData.email });
            
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
                // Check if this is a verification required error
                if (data.requiresVerification) {
                    setShowVerificationMessage(true);
                    setVerificationEmail(data.email || formData.email);
                    logger.info('Verification required', { email: data.email || formData.email });
                    return;
                }
                throw new ApiError(
                    data.error || 'Authentication failed',
                    res.status,
                    endpoint
                );
            }

            // Check if registration requires verification
            if (data.requiresVerification) {
                setShowVerificationMessage(true);
                setVerificationEmail(formData.email);
                logger.info('Registration requires verification', { email: formData.email });
                return;
            }

            if (data.user) {
                login(data.user);
                logger.info('Authentication successful', { email: formData.email });
            }
        } catch (err) {
            const appError = handleError(err);
            setError(appError.userMessage || appError.message);
            logger.error('Authentication failed', appError, { endpoint, email: formData.email });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setIsResending(true);
        setError('');
        setResendSuccess(false);

        try {
            logger.debug('Resending verification email', { email: verificationEmail });
            
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
                throw new ApiError(
                    data.error || 'Failed to resend verification email',
                    res.status,
                    '/auth/resend-verification'
                );
            }

            setResendSuccess(true);
            logger.info('Verification email resent successfully', { email: verificationEmail });
        } catch (err) {
            const appError = handleError(err);
            setError(appError.userMessage || appError.message);
            logger.error('Failed to resend verification email', appError, { email: verificationEmail });
        } finally {
            setIsResending(false);
        }
    };

    // Show verification message screen
    if (showVerificationMessage) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-[var(--bg-card)] rounded-2xl p-8 shadow-lg border border-gray-100">
                        <div className="flex items-center justify-center mx-auto mb-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-[#1e3a5f] to-[#2d4a6f] rounded-full flex items-center justify-center shadow-md">
                                <Envelope weight="light" className="w-10 h-10 text-white" />
                            </div>
                        </div>
                        
                        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-3">Check your email</h1>
                        <p className="text-gray-600 text-center mb-2 text-sm">
                            We've sent a verification link to
                        </p>
                        <p className="text-gray-900 font-semibold text-center mb-6 break-all">
                            {verificationEmail}
                        </p>
                        
                        <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed">
                            Click the link in the email to verify your account and start using Intemic.
                        </p>

                        {resendSuccess && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 mb-4 flex items-center gap-2 justify-center">
                                <CheckCircle weight="light" className="w-5 h-5 flex-shrink-0" />
                                <span>Verification email sent!</span>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
                                {error}
                            </div>
                        )}
                        
                        <button
                            onClick={handleResendVerification}
                            disabled={isResending}
                            className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4 border border-gray-200 hover:border-gray-300"
                        >
                            {isResending ? (
                                <>
                                    <SpinnerGap weight="light" className="w-5 h-5 animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowClockwise weight="light" className="w-4 h-4" />
                                    <span>Resend verification email</span>
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
                            className="w-full text-sm text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors font-medium py-2"
                        >
                            ← Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-[var(--bg-card)] rounded-2xl p-8 shadow-lg border border-gray-100">
                    {/* Logo */}
                    <div className="mb-8 flex justify-center">
                        <img
                            src="/logo.svg"
                            alt="Intemic"
                            className="h-10 w-auto object-contain"
                        />
                    </div>

                    {/* Title */}
                    <div className="mb-8 text-center">
                        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                            {isLogin ? 'Sign in to your account' : 'Create your account'}
                        </h1>
                        <p className="text-sm text-gray-600">
                            {isLogin ? (
                                <>Don't have an account?{' '}
                                    <button 
                                        onClick={() => setIsLogin(false)} 
                                        className="font-semibold text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors underline underline-offset-2"
                                    >
                                        Sign up
                                    </button>
                                </>
                            ) : (
                                <>Already have an account?{' '}
                                    <button 
                                        onClick={() => setIsLogin(true)} 
                                        className="font-semibold text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors underline underline-offset-2"
                                    >
                                        Sign in
                                    </button>
                                </>
                            )}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-[var(--bg-card)] border border-gray-200 rounded-xl py-3 px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Organization Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-[var(--bg-card)] border border-gray-200 rounded-xl py-3 px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                        placeholder="Acme Inc."
                                        value={formData.orgName}
                                        onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                className="w-full bg-[var(--bg-card)] border border-gray-200 rounded-xl py-3 px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                placeholder="name@company.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Password
                                </label>
                                {isLogin && (
                                    <Link 
                                        to="/forgot-password" 
                                        className="text-xs font-medium text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full bg-[var(--bg-card)] border border-gray-200 rounded-xl py-3 px-4 pr-12 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition-all"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeSlash weight="light" className="w-5 h-5" /> : <Eye weight="light" className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f] hover:from-[#2d4a6f] hover:to-[#3d5a7f] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {isLoading ? (
                                <>
                                    <SpinnerGap weight="light" className="w-5 h-5 animate-spin" />
                                    <span>Please wait...</span>
                                </>
                            ) : (
                                <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
