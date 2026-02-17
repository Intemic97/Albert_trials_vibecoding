/**
 * AIAssistantSidePanel
 * Extracted from Workflows.tsx - AI Assistant Panel (~134 lines)
 */

import React from 'react';
import { FlowArrow as Workflow, Sparkle as Sparkles, Check, XCircle, CheckCircle, X } from '@phosphor-icons/react';

interface AIWorkflowMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  workflowSuggestion?: {
    type: 'nodes' | 'connections' | 'modification';
    description: string;
    nodes?: any[];
    connections?: any[];
    status: 'pending' | 'accepted' | 'rejected';
  };
}

interface AIAssistantSidePanelProps {
  show: boolean;
  onClose: () => void;
  messages: AIWorkflowMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  isLoading: boolean;
  onSend: () => void;
  onAcceptSuggestion: () => void;
  onRejectSuggestion: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const AIAssistantSidePanel: React.FC<AIAssistantSidePanelProps> = ({
  show, onClose, messages, chatInput, setChatInput, isLoading,
  onSend, onAcceptSuggestion, onRejectSuggestion, messagesEndRef
}) => {
  if (!show) return null;

  return (
    <div className="fixed top-0 right-0 w-[450px] h-screen bg-[var(--bg-card)] border-l border-[var(--border-light)] flex flex-col shadow-2xl z-50">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-light)] px-6 py-4 text-[var(--text-primary)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles size={24} />
          <div>
            <h3 className="font-normal text-lg">AI Workflow Assistant</h3>
            <p className="text-sm text-[var(--text-tertiary)]">Ask me about your workflow</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-card)]/20 rounded-lg transition-colors" title="Close">
          <X size={20} />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-tertiary)]">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-tertiary)]">
            <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">AI Workflow Assistant</p>
            <p className="text-xs mt-2 px-6">
              I can help you build workflows, suggest nodes, and answer questions about your automation.
            </p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-slate-700 text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)]'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Workflow Suggestion Card */}
                  {message.workflowSuggestion && (
                    <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-medium)]">
                      <div className="flex items-center gap-2 mb-2">
                        <Workflow size={16} className="text-[var(--text-secondary)]" />
                        <span className="text-xs font-normal text-[var(--text-primary)] uppercase tracking-wide">
                          Workflow Suggestion
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        {message.workflowSuggestion.description}
                      </p>

                      {message.workflowSuggestion.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={onAcceptSuggestion}
                            className="flex-1 px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            <Check size={14} />
                            Accept
                          </button>
                          <button
                            onClick={onRejectSuggestion}
                            className="flex-1 px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs font-medium hover:bg-[var(--border-medium)] transition-colors flex items-center justify-center gap-1"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </div>
                      )}

                      {message.workflowSuggestion.status === 'accepted' && (
                        <div className="flex items-center gap-2 text-[var(--accent-primary)] text-xs font-medium">
                          <CheckCircle size={14} />
                          <span>Applied to workflow</span>
                        </div>
                      )}

                      {message.workflowSuggestion.status === 'rejected' && (
                        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs font-medium">
                          <XCircle size={14} />
                          <span>Rejected</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-card)]">
        {isLoading && (
          <div className="mb-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <div className="w-4 h-4 border-2 border-[var(--border-medium)] border-t-slate-600 rounded-full animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Ask me to add nodes, modify connections, or explain your workflow..."
            className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm resize-none focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={onSend}
            disabled={!chatInput.trim() || isLoading}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Sparkles size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};




