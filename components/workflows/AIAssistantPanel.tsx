/**
 * AIAssistantPanel - Panel de asistente IA para workflows
 * 
 * Permite generar workflows completos con IA y chatear
 * para obtener sugerencias de modificaciones.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  PaperPlaneTilt,
  Sparkle as Sparkles,
  Robot,
  User,
  ArrowsClockwise,
  Plus,
  Check,
  CaretRight,
  SpinnerGap,
} from '@phosphor-icons/react';
import { useWorkflowStore } from '../../stores';
import { API_BASE } from '../../config';
import { generateUUID } from '../../utils/uuid';
import type { WorkflowNode, Connection } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestion?: {
    type: 'add_nodes' | 'modify' | 'explain';
    nodes?: WorkflowNode[];
    connections?: Connection[];
  };
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entities?: any[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  isOpen,
  onClose,
  entities = [],
}) => {
  // Store
  const workflow = useWorkflowStore(state => state.workflow);
  const nodes = useWorkflowStore(state => state.nodes);
  const connections = useWorkflowStore(state => state.connections);
  const setNodes = useWorkflowStore(state => state.setNodes);
  const setConnections = useWorkflowStore(state => state.setConnections);
  const addNode = useWorkflowStore(state => state.addNode);
  const addConnection = useWorkflowStore(state => state.addConnection);
  
  // Local state
  const [mode, setMode] = useState<'generate' | 'chat'>('generate');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<{
    nodes: any[];
    connections: any[];
  } | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);
  
  // =========================================================================
  // HANDLERS
  // =========================================================================
  
  const handleGenerateWorkflow = async () => {
    if (!prompt.trim() || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/generate-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          entities: entities.map(e => ({
            id: e.id,
            name: e.name,
            properties: e.properties?.map((p: any) => ({ name: p.name, type: p.type })) || []
          }))
        }),
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Failed to generate workflow');
      
      const data = await res.json();
      
      if (data.nodes && data.connections) {
        setGeneratedWorkflow(data);
      }
    } catch (error) {
      console.error('Error generating workflow:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const applyWorkflow = (mode: 'replace' | 'add') => {
    if (!generatedWorkflow) return;
    
    const { nodes: newNodes, connections: newConnections } = generatedWorkflow;
    
    // Process nodes with new IDs
    const idMap: Record<string, string> = {};
    const offset = mode === 'add' && nodes.length > 0 
      ? Math.max(...nodes.map(n => n.x)) + 300 
      : 0;
    
    const processedNodes: WorkflowNode[] = newNodes.map((n: any) => {
      const newId = generateUUID();
      idMap[n.id] = newId;
      return {
        id: newId,
        type: n.type,
        label: n.label,
        x: n.x + offset,
        y: n.y,
        config: n.config || {},
        status: 'idle' as const
      };
    });
    
    const processedConnections: Connection[] = newConnections
      .map((c: any) => ({
        id: generateUUID(),
        fromNodeId: idMap[c.fromNodeId],
        toNodeId: idMap[c.toNodeId],
        outputType: c.outputType,
        inputPort: c.inputPort
      }))
      .filter((c: Connection) => c.fromNodeId && c.toNodeId);
    
    if (mode === 'replace') {
      setNodes(processedNodes);
      setConnections(processedConnections);
    } else {
      processedNodes.forEach(node => addNode(node));
      processedConnections.forEach(conn => addConnection(conn));
    }
    
    // Cleanup
    setGeneratedWorkflow(null);
    setPrompt('');
  };
  
  const handleSendMessage = async () => {
    if (!prompt.trim() || isLoading) return;
    
    const userMessage: AIMessage = {
      id: generateUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/workflows/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          workflowId: workflow.id,
          workflowName: workflow.name,
          nodes,
          connections,
          entities: entities.map(e => ({
            id: e.id,
            name: e.name,
            properties: e.properties?.map((p: any) => ({ name: p.name, type: p.type })) || []
          }))
        }),
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Failed to get AI response');
      
      const data = await res.json();
      
      const assistantMessage: AIMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: data.message || data.response || 'No response',
        timestamp: new Date(),
        suggestion: data.suggestion
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: AIMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const applySuggestion = (suggestion: AIMessage['suggestion']) => {
    if (!suggestion) return;
    
    if (suggestion.nodes) {
      const idMap: Record<string, string> = {};
      const offset = nodes.length > 0 ? Math.max(...nodes.map(n => n.x)) + 300 : 0;
      
      suggestion.nodes.forEach(node => {
        const newId = generateUUID();
        idMap[node.id] = newId;
        addNode({
          ...node,
          id: newId,
          x: node.x + offset,
          status: 'idle'
        });
      });
      
      if (suggestion.connections) {
        suggestion.connections.forEach(conn => {
          addConnection({
            ...conn,
            id: generateUUID(),
            fromNodeId: idMap[conn.fromNodeId] || conn.fromNodeId,
            toNodeId: idMap[conn.toNodeId] || conn.toNodeId
          });
        });
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'generate') {
        handleGenerateWorkflow();
      } else {
        handleSendMessage();
      }
    }
  };
  
  // =========================================================================
  // RENDER
  // =========================================================================
  
  if (!isOpen) return null;
  
  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-[var(--bg-card)] border-l border-[var(--border-light)] flex flex-col z-40 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-[var(--accent-primary)]" weight="fill" />
          <span className="font-medium text-[var(--text-primary)]">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
        >
          <X size={18} className="text-[var(--text-secondary)]" />
        </button>
      </div>
      
      {/* Mode tabs */}
      <div className="flex border-b border-[var(--border-light)]">
        <button
          onClick={() => setMode('generate')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === 'generate'
              ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Generar Workflow
        </button>
        <button
          onClick={() => setMode('chat')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === 'chat'
              ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Chat
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'generate' ? (
          // Generate mode
          <div className="space-y-4">
            {!generatedWorkflow ? (
              <>
                <p className="text-sm text-[var(--text-secondary)]">
                  Describe el workflow que quieres crear y la IA lo generará automáticamente.
                </p>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase">Ejemplos</p>
                  {[
                    'Workflow para procesar datos de producción y calcular KPIs',
                    'Flujo de validación de calidad con alertas por email',
                    'Pipeline de datos: Excel → Transformación → Dashboard'
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(example)}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                      <CaretRight size={12} className="inline mr-1" />
                      {example}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              // Show generated workflow preview
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm font-medium text-emerald-600 mb-1">
                    Workflow generado
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {generatedWorkflow.nodes.length} nodos, {generatedWorkflow.connections.length} conexiones
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--text-tertiary)]">Nodos:</p>
                  {generatedWorkflow.nodes.map((node: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg text-sm">
                      <span className="w-5 h-5 rounded bg-[var(--accent-primary)]/20 flex items-center justify-center text-xs text-[var(--accent-primary)]">
                        {i + 1}
                      </span>
                      <span className="text-[var(--text-primary)]">{node.label}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">({node.type})</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => applyWorkflow('replace')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors text-sm font-medium"
                  >
                    <ArrowsClockwise size={16} />
                    Reemplazar
                  </button>
                  <button
                    onClick={() => applyWorkflow('add')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm font-medium border border-[var(--border-light)]"
                  >
                    <Plus size={16} />
                    Añadir
                  </button>
                </div>
                
                <button
                  onClick={() => setGeneratedWorkflow(null)}
                  className="w-full text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ) : (
          // Chat mode
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Robot size={48} className="mx-auto text-[var(--text-tertiary)] mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">
                  Pregúntame sobre tu workflow o pide sugerencias de mejora.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                      <Robot size={16} className="text-[var(--accent-primary)]" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.suggestion && msg.suggestion.nodes && (
                      <button
                        onClick={() => applySuggestion(msg.suggestion)}
                        className="mt-2 flex items-center gap-1 px-2 py-1 bg-white/20 rounded text-xs font-medium hover:bg-white/30 transition-colors"
                      >
                        <Check size={12} />
                        Aplicar sugerencia
                      </button>
                    )}
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-[var(--text-secondary)]" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center">
                  <SpinnerGap size={16} className="text-[var(--accent-primary)] animate-spin" />
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-[var(--border-light)]">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'generate' 
              ? 'Describe el workflow que quieres crear...'
              : 'Escribe tu mensaje...'
            }
            className="w-full px-4 py-3 pr-12 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={mode === 'generate' ? handleGenerateWorkflow : handleSendMessage}
            disabled={!prompt.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <SpinnerGap size={18} className="animate-spin" />
            ) : (
              <PaperPlaneTilt size={18} weight="fill" />
            )}
          </button>
        </div>
        
        <p className="mt-2 text-xs text-[var(--text-tertiary)] text-center">
          Enter para enviar • Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
};

export default AIAssistantPanel;
