/**
 * Hook for managing node configuration state
 * Centralizes the state management for all node configuration modals
 */

import { useState, useCallback } from 'react';
import { WorkflowNode } from '../types';

export interface NodeConfigState {
  // General
  configuringNodeId: string | null;
  
  // HTTP Node
  configuringHttpNodeId: string | null;
  httpUrl: string;
  
  // ESIOS Node
  configuringEsiosNodeId: string | null;
  esiosArchiveId: string;
  esiosDate: string;
  
  // Condition Node
  configuringConditionNodeId: string | null;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  processingMode: 'batch' | 'perRow';
  
  // Add Field Node
  configuringAddFieldNodeId: string | null;
  addFieldName: string;
  addFieldValue: string;
  
  // Join Node
  configuringJoinNodeId: string | null;
  joinStrategy: 'concat' | 'mergeByKey';
  joinType: 'inner' | 'outer';
  joinKey: string;
  
  // Split Columns Node
  configuringSplitColumnsNodeId: string | null;
  
  // Excel Node
  configuringExcelNodeId: string | null;
  
  // PDF Node
  configuringPdfNodeId: string | null;
  
  // LLM Node
  configuringLLMNodeId: string | null;
  llmPrompt: string;
  llmContextEntities: string[];
  llmIncludeInput: boolean;
  
  // Python Node
  configuringPythonNodeId: string | null;
  pythonCode: string;
  pythonAiPrompt: string;
  
  // Manual Input Node
  configuringManualInputNodeId: string | null;
  inputVarName: string;
  inputVarValue: string;
  
  // Save Records Node
  configuringSaveRecordsNodeId: string | null;
  
  // PDF Report Node
  configuringPdfReportNodeId: string | null;
}

const initialState: NodeConfigState = {
  configuringNodeId: null,
  configuringHttpNodeId: null,
  httpUrl: '',
  configuringEsiosNodeId: null,
  esiosArchiveId: '',
  esiosDate: '',
  configuringConditionNodeId: null,
  conditionField: '',
  conditionOperator: 'equals',
  conditionValue: '',
  processingMode: 'batch',
  configuringAddFieldNodeId: null,
  addFieldName: '',
  addFieldValue: '',
  configuringJoinNodeId: null,
  joinStrategy: 'concat',
  joinType: 'inner',
  joinKey: '',
  configuringSplitColumnsNodeId: null,
  configuringExcelNodeId: null,
  configuringPdfNodeId: null,
  configuringLLMNodeId: null,
  llmPrompt: '',
  llmContextEntities: [],
  llmIncludeInput: true,
  configuringPythonNodeId: null,
  pythonCode: '',
  pythonAiPrompt: '',
  configuringManualInputNodeId: null,
  inputVarName: '',
  inputVarValue: '',
  configuringSaveRecordsNodeId: null,
  configuringPdfReportNodeId: null,
};

export function useNodeConfig(nodes: WorkflowNode[]) {
  const [state, setState] = useState<NodeConfigState>(initialState);

  // Generic open config
  const openConfig = useCallback((nodeId: string, nodeType: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    switch (nodeType) {
      case 'fetchData':
        setState(prev => ({ ...prev, configuringNodeId: nodeId }));
        break;
      case 'http':
        setState(prev => ({
          ...prev,
          configuringHttpNodeId: nodeId,
          httpUrl: node.config?.httpUrl || '',
        }));
        break;
      case 'esios':
        setState(prev => ({
          ...prev,
          configuringEsiosNodeId: nodeId,
          esiosArchiveId: node.config?.esiosArchiveId || '',
          esiosDate: node.config?.esiosDate || new Date().toISOString().split('T')[0],
        }));
        break;
      case 'condition':
        setState(prev => ({
          ...prev,
          configuringConditionNodeId: nodeId,
          conditionField: node.config?.conditionField || '',
          conditionOperator: node.config?.conditionOperator || 'equals',
          conditionValue: node.config?.conditionValue || '',
          processingMode: node.config?.processingMode || 'batch',
        }));
        break;
      case 'addField':
        setState(prev => ({
          ...prev,
          configuringAddFieldNodeId: nodeId,
          addFieldName: '',
          addFieldValue: '',
        }));
        break;
      case 'join':
        setState(prev => ({
          ...prev,
          configuringJoinNodeId: nodeId,
          joinStrategy: node.config?.joinStrategy || 'concat',
          joinType: node.config?.joinType || 'inner',
          joinKey: node.config?.joinKey || '',
        }));
        break;
      case 'llm':
        setState(prev => ({
          ...prev,
          configuringLLMNodeId: nodeId,
          llmPrompt: node.config?.llmPrompt || '',
          llmContextEntities: node.config?.llmContextEntities || [],
          llmIncludeInput: node.config?.llmIncludeInput ?? true,
        }));
        break;
      case 'python':
        setState(prev => ({
          ...prev,
          configuringPythonNodeId: nodeId,
          pythonCode: node.config?.pythonCode || '',
          pythonAiPrompt: node.config?.pythonAiPrompt || '',
        }));
        break;
      case 'manualInput':
        setState(prev => ({
          ...prev,
          configuringManualInputNodeId: nodeId,
          inputVarName: node.config?.inputVarName || '',
          inputVarValue: node.config?.inputVarValue || '',
        }));
        break;
      case 'excelInput':
        setState(prev => ({ ...prev, configuringExcelNodeId: nodeId }));
        break;
      case 'pdfInput':
        setState(prev => ({ ...prev, configuringPdfNodeId: nodeId }));
        break;
      case 'splitColumns':
        setState(prev => ({ ...prev, configuringSplitColumnsNodeId: nodeId }));
        break;
      case 'saveRecords':
        setState(prev => ({ ...prev, configuringSaveRecordsNodeId: nodeId }));
        break;
      case 'pdfReport':
        setState(prev => ({ ...prev, configuringPdfReportNodeId: nodeId }));
        break;
    }
  }, [nodes]);

  // Close all configs
  const closeAllConfigs = useCallback(() => {
    setState(initialState);
  }, []);

  // Close specific config
  const closeConfig = useCallback((configType: keyof NodeConfigState) => {
    setState(prev => ({ ...prev, [configType]: null }));
  }, []);

  // Update field
  const updateField = useCallback(<K extends keyof NodeConfigState>(
    field: K,
    value: NodeConfigState[K]
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    state,
    openConfig,
    closeConfig,
    closeAllConfigs,
    updateField,
  };
}

export type UseNodeConfigReturn = ReturnType<typeof useNodeConfig>;
