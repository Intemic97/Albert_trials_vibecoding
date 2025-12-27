import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Loader2, CheckCircle, AlertCircle, FileText, Send, ArrowRight } from 'lucide-react';
import { API_BASE } from '../config';

interface WorkflowInput {
    nodeId: string;
    varName: string;
    label: string;
    defaultValue?: string;
}

interface WorkflowInfo {
    id: string;
    name: string;
    description?: string;
    inputs: WorkflowInput[];
}

export const PublicWorkflowForm: React.FC = () => {
    const { workflowId } = useParams<{ workflowId: string }>();
    const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkflowInfo();
    }, [workflowId]);

    const fetchWorkflowInfo = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_BASE}/workflow/${workflowId}/public`);
            
            if (!res.ok) {
                if (res.status === 404) {
                    setError('Workflow not found');
                } else {
                    setError('Failed to load workflow');
                }
                return;
            }

            const data = await res.json();
            setWorkflow(data);
            
            // Initialize input values with defaults
            const initialValues: Record<string, string> = {};
            data.inputs?.forEach((input: WorkflowInput) => {
                initialValues[input.nodeId] = input.defaultValue || '';
            });
            setInputValues(initialValues);
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError(null);
        setResult(null);

        try {
            const res = await fetch(`${API_BASE}/workflow/${workflowId}/run-public`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: inputValues })
            });

            const data = await res.json();

            if (!res.ok) {
                setSubmitError(data.error || 'Failed to run workflow');
                return;
            }

            // Extract meaningful results
            const executionResult = {
                executionId: data.executionId,
                status: data.status,
                nodeResults: data.result || {}
            };

            // Find output node results
            const outputResults = Object.entries(executionResult.nodeResults)
                .filter(([_, value]: [string, any]) => value?.isFinal || value?.outputData)
                .map(([nodeId, value]: [string, any]) => ({
                    nodeId,
                    data: value?.outputData || value
                }));

            setResult({
                ...executionResult,
                outputs: outputResults.length > 0 ? outputResults : null
            });
        } catch (err) {
            setSubmitError('Failed to connect to server');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (nodeId: string, value: string) => {
        setInputValues(prev => ({ ...prev, [nodeId]: value }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading workflow...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-red-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Oops!</h1>
                    <p className="text-slate-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl text-white">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{workflow?.name || 'Workflow'}</h1>
                            {workflow?.description && (
                                <p className="text-sm text-slate-500">{workflow.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="max-w-3xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Input Fields */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Send size={18} className="text-teal-600" />
                                Inputs
                            </h2>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            {workflow?.inputs && workflow.inputs.length > 0 ? (
                                workflow.inputs.map((input) => (
                                    <div key={input.nodeId}>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            {input.label || input.varName}
                                        </label>
                                        <textarea
                                            value={inputValues[input.nodeId] || ''}
                                            onChange={(e) => handleInputChange(input.nodeId, e.target.value)}
                                            placeholder={`Enter ${input.label || input.varName}...`}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-center py-4">
                                    This workflow has no input fields.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl font-semibold text-lg shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 hover:from-teal-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Running workflow...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Run Workflow
                            </>
                        )}
                    </button>

                    {/* Error Message */}
                    {submitError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-800">Error</p>
                                <p className="text-sm text-red-600">{submitError}</p>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-emerald-200">
                                <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
                                    <CheckCircle size={18} className="text-emerald-600" />
                                    Workflow Executed Successfully
                                </h2>
                                <p className="text-sm text-emerald-600 mt-1">
                                    Execution ID: {result.executionId}
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                {result.outputs && result.outputs.length > 0 ? (
                                    result.outputs.map((output: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <p className="text-xs text-slate-500 mb-2 font-medium">Output {idx + 1}</p>
                                            <pre className="overflow-x-auto text-sm text-slate-700 whitespace-pre-wrap">
                                                {typeof output.data === 'string' 
                                                    ? output.data 
                                                    : JSON.stringify(output.data, null, 2)}
                                            </pre>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <p className="text-xs text-slate-500 mb-2 font-medium">Full Result</p>
                                        <pre className="overflow-x-auto text-sm text-slate-700 whitespace-pre-wrap">
                                            {JSON.stringify(result.nodeResults, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 py-3">
                <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                    <span>Powered by</span>
                    <a href="https://intemic.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                        Intemic
                    </a>
                </div>
            </div>
        </div>
    );
};

