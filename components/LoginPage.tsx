import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Envelope, SpinnerGap, CheckCircle, ArrowClockwise, Eye, EyeSlash, User, Buildings } from '@phosphor-icons/react';
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
                        <div className="flex items-center justify-center mx-auto mb-8">
                            <div className="w-16 h-16 bg-[var(--accent-primary)] rounded-full flex items-center justify-center">
                                <Envelope weight="light" className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        
                        <h1 className="text-xl font-medium text-[#e8e8e8] text-center mb-3" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                            Check your email
                        </h1>
                        <p className="text-[#9b9b9b] text-center mb-2 text-sm">
                            We've sent a verification link to
                        </p>
                        <p className="text-[#e8e8e8] font-medium text-center mb-8 break-all">
                            {verificationEmail}
                        </p>
                        
                        <p className="text-sm text-[#6b6b6b] text-center mb-8 leading-relaxed">
                            Click the link in the email to verify your account and start using Intemic.
                        </p>

                        {resendSuccess && (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400 mb-4 flex items-center gap-2 justify-center">
                                <CheckCircle weight="fill" className="w-4 h-4 flex-shrink-0" />
                                <span>Verification email sent!</span>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 mb-4 text-center">
                                {error}
                            </div>
                        )}
                        
                        <button
                            onClick={handleResendVerification}
                            disabled={isResending}
                            className="w-full bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#e8e8e8] font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4 border border-[#404040]"
                        >
                            {isResending ? (
                                <>
                                    <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowClockwise weight="bold" className="w-4 h-4" />
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
                            className="w-full text-sm text-[#9b9b9b] hover:text-[#e8e8e8] transition-colors font-medium py-2"
                        >
                            ← Back to sign in
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="py-6 text-center">
                    <p className="text-xs text-[#6b6b6b]">
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
                    {/* Title */}
                    <h1 className="text-xl font-medium text-[#e8e8e8] text-center mb-8" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                        {isLogin ? 'Sign in' : 'Create account'}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                {/* Full Name */}
                                <div className="relative">
                                    <User weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                        placeholder="Full name"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                {/* Organization */}
                                <div className="relative">
                                    <Buildings weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                        placeholder="Organization name"
                                        value={formData.orgName}
                                        onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {/* Email */}
                        <div className="relative">
                            <Envelope weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                            <input
                                type="email"
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 pl-10 pr-4 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                placeholder="Enter your work email address"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="w-full bg-[#2f2f2f] border border-[#404040] rounded-lg py-3 px-4 pr-12 text-[#e8e8e8] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all text-sm"
                                placeholder="Password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#9b9b9b] transition-colors p-1"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeSlash weight="light" className="w-4 h-4" /> : <Eye weight="light" className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Forgot Password Link */}
                        {isLogin && (
                            <div className="text-right">
                                <Link 
                                    to="/forgot-password" 
                                    className="text-xs text-[#6b6b6b] hover:text-[#9b9b9b] transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary btn-primary-lg flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                                    <span>Please wait...</span>
                                </>
                            ) : (
                                <span>{isLogin ? 'Continue' : 'Create account'}</span>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-[#333333]"></div>
                    </div>

                    {/* Toggle Sign In/Sign Up */}
                    <p className="text-sm text-[#6b6b6b] text-center">
                        {isLogin ? (
                            <>Don't have an account?{' '}
                                <button 
                                    onClick={() => setIsLogin(false)} 
                                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors font-medium"
                                >
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>Already have an account?{' '}
                                <button 
                                    onClick={() => setIsLogin(true)} 
                                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors font-medium"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="py-6 text-center space-y-3">
                <p className="text-xs text-[#505050] max-w-xs mx-auto leading-relaxed">
                    By proceeding you acknowledge that you have read, understood and agree to our{' '}
                    <a href="/terms" className="text-[#6b6b6b] hover:text-[#9b9b9b] underline transition-colors">Terms and Conditions</a>.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-[#505050]">
                    <span>© {new Date().getFullYear()} Intemic</span>
                    <a href="/privacy" className="hover:text-[#6b6b6b] transition-colors">Privacy Policy</a>
                    <a href="/support" className="hover:text-[#6b6b6b] transition-colors">Support</a>
                </div>
            </div>
        </div>
    );
}
