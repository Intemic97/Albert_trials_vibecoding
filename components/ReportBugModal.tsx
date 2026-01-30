import React, { useState } from 'react';
import { X, Bug, PaperPlaneTilt, SpinnerGap } from '@phosphor-icons/react';
import { API_BASE } from '../config';

interface ReportBugModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReportBugModal: React.FC<ReportBugModalProps> = ({ isOpen, onClose }) => {
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            setFeedback({ type: 'error', message: 'Please provide a description' });
            return;
        }

        setIsSubmitting(true);
        setFeedback(null);

        try {
            // In a real app, you'd send this to your backend
            // For now, we'll just simulate it
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // You could send to an API endpoint like:
            // await fetch(`${API_BASE}/feedback/bug`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     credentials: 'include',
            //     body: JSON.stringify({ description, steps })
            // });

            setFeedback({ type: 'success', message: 'Thank you! Your bug report has been submitted.' });
            setTimeout(() => {
                setDescription('');
                setSteps('');
                setFeedback(null);
                onClose();
            }, 2000);
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to submit bug report. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] animate-in fade-in duration-200">
            <div 
                className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg">
                            <Bug size={18} className="text-red-600" />
                        </div>
                        <h2 className="text-base font-normal text-[var(--text-primary)]">Report a Bug</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={18} className="text-slate-400" weight="light" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                            What went wrong? <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the bug you encountered..."
                            rows={4}
                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-slate-400 resize-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                            Steps to reproduce (optional)
                        </label>
                        <textarea
                            value={steps}
                            onChange={(e) => setSteps(e.target.value)}
                            placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                            rows={3}
                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-slate-400 resize-none"
                        />
                    </div>

                    {feedback && (
                        <div className={`p-3 rounded-lg text-sm ${
                            feedback.type === 'success' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {feedback.message}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 border border-[var(--border-light)] rounded-lg hover:bg-slate-50 text-sm font-medium text-[var(--text-primary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !description.trim()}
                            className="px-3 py-2 btn-3d btn-primary-3d disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Submit Report
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
