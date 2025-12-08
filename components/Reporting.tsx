import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Entity, Property } from '../types';
import { Send, Sparkles, Database, Hash, Type, Link as LinkIcon, FileText, Clipboard, FlaskConical, Wrench, AlertTriangle } from 'lucide-react';

interface ReportingProps {
    entities: Entity[];
}

type MentionType = 'entity' | 'attribute';

interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    prompt: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface MentionState {
    isActive: boolean;
    type: MentionType;
    query: string;
    top: number;
    left: number;
    triggerIndex: number;
    entityContext?: Entity; // For attribute mentions
}

// GMP Report Templates
const reportTemplates: ReportTemplate[] = [
    {
        id: 'production-summary',
        name: 'GMP Production Summary',
        description: 'Comprehensive production report covering batches, yields, and deviations',
        icon: FileText,
        prompt: `Generate a comprehensive GMP Production Summary Report with the following sections:

1. Executive Summary
   - Overview of production activities in the reporting period
   - Key performance indicators and metrics
   - Critical findings and recommendations

2. Batch Production Overview
   - List all batches produced (reference relevant @Entity data)
   - Batch numbers, product names, and quantities
   - Production dates and timelines
   - Batch yield analysis and efficiency metrics

3. Manufacturing Process Analysis
   - Process performance evaluation
   - Any deviations from standard operating procedures
   - In-process controls and results

4. Resource Utilization
   - Equipment usage and availability
   - Material consumption and inventory status
   - Personnel allocation and productivity

5. Quality Metrics
   - In-process quality control results
   - Trending of critical quality parameters
   - Any out-of-specification events

6. Deviations and Investigations
   - Summary of any deviations encountered
   - Status of investigations
   - Corrective actions implemented

7. Recommendations
   - Areas for improvement
   - Process optimization opportunities
   - Resource requirements

Please provide detailed analysis with data-driven insights.`
    },
    {
        id: 'quality-control',
        name: 'Quality Control Report',
        description: 'Focus on testing, specifications, and quality events',
        icon: FlaskConical,
        prompt: `Generate a detailed Quality Control Report including:

1. QC Testing Summary
   - Overview of all quality control tests performed
   - Test methods and specifications used
   - Sample types and quantities tested

2. Test Results Analysis
   - Summary of results by product/batch (reference @Entity data)
   - Comparison against specifications
   - Trending of key quality parameters
   - Statistical analysis where applicable

3. Out-of-Specification (OOS) Events
   - List of any OOS results during the period
   - Investigation status and findings
   - Root cause analysis
   - CAPA implementation status

4. Method Performance
   - Method validation status
   - System suitability results
   - Instrument qualification status
   - Any method deviations or issues

5. Reference Standards and Reagents
   - Status of reference standards
   - Reagent qualification and usage
   - Expiry tracking

6. Laboratory Equipment
   - Calibration status
   - Maintenance records
   - Any equipment failures or issues

7. Quality Trends and Recommendations
   - Trending analysis of quality data
   - Areas of concern
   - Recommendations for improvement

Provide comprehensive analysis with supporting data.`
    },
    {
        id: 'batch-record',
        name: 'Batch Record Analysis',
        description: 'Detailed analysis of specific batch records and processes',
        icon: Clipboard,
        prompt: `Generate a comprehensive Batch Record Analysis Report:

1. Batch Identification
   - Batch number and product details (reference @Entity)
   - Manufacturing date and location
   - Batch size and intended use

2. Raw Materials and Components
   - List of all materials used
   - Supplier information and lot numbers
   - Material testing and release status
   - Any substitutions or deviations

3. Manufacturing Process Review
   - Step-by-step process execution
   - Critical process parameters and actual values
   - In-process controls and results
   - Process times and environmental conditions

4. Equipment Used
   - List of equipment utilized
   - Equipment IDs and calibration status
   - Cleaning verification

5. Batch Documentation Review
   - Completeness of batch records
   - Electronic signatures/approvals
   - Any corrections or modifications
   - Deviation documentation

6. Yield Reconciliation
   - Theoretical vs. actual yield
   - Material balance
   - Investigation of any yield discrepancies

7. Quality Testing
   - In-process test results
   - Final product testing
   - Compliance with specifications

8. Batch Disposition
   - Release decision and justification
   - Any special conditions or holds
   - Distribution information

9. Overall Assessment
   - Batch compliance summary
   - Issues identified
   - Lessons learned

Provide detailed, GMP-compliant analysis.`
    },
    {
        id: 'equipment-utilization',
        name: 'Equipment Utilization Report',
        description: 'Analysis of equipment usage, maintenance, and capacity',
        icon: Wrench,
        prompt: `Generate an Equipment Utilization and Performance Report:

1. Equipment Inventory Overview
   - List of all manufacturing equipment (reference @Entity data)
   - Equipment classification and criticality
   - Location and assignment

2. Utilization Analysis
   - Equipment usage hours vs. available hours
   - Utilization rates by equipment type
   - Production capacity analysis
   - Bottleneck identification

3. Performance Metrics
   - Equipment efficiency ratings
   - Downtime analysis
   - Mean time between failures (MTBF)
   - Overall equipment effectiveness (OEE)

4. Maintenance Activities
   - Preventive maintenance schedule compliance
   - Corrective maintenance events
   - Maintenance costs and trends
   - Parts consumption and inventory

5. Qualification and Calibration Status
   - Equipment qualification status
   - Calibration schedule and compliance
   - Any overdue qualifications/calibrations
   - Requalification requirements

6. Cleaning and Changeover
   - Cleaning verification results
   - Changeover times and efficiency
   - Cross-contamination prevention

7. Equipment Issues and Deviations
   - Equipment-related deviations
   - Failures and their impact
   - Investigation status

8. Capacity Planning
   - Current capacity vs. demand
   - Future capacity requirements
   - Equipment replacement/upgrade needs

9. Recommendations
   - Optimization opportunities
   - Investment priorities
   - Process improvements

Provide data-driven insights for decision-making.`
    },
    {
        id: 'deviation-capa',
        name: 'Deviation & CAPA Report',
        description: 'Corrective actions, preventive actions, and root cause analysis',
        icon: AlertTriangle,
        prompt: `Generate a comprehensive Deviation and CAPA Report:

1. Deviation Summary
   - Total number of deviations in the period
   - Deviation classification (critical, major, minor)
   - Status breakdown (open, under investigation, closed)
   - Trending by type and area (reference @Entity data)

2. Deviation Details
   - Description of each significant deviation
   - Impact assessment
   - Immediate actions taken
   - Product/batch impact

3. Root Cause Analysis
   - Investigation methodology used
   - Root causes identified
   - Contributing factors
   - Why-why analysis or fishbone diagrams

4. CAPA Implementation
   - Corrective actions implemented
   - Preventive actions planned/executed
   - Effectiveness verification
   - Evidence of implementation

5. Recurrence Analysis
   - Repeat deviations identified
   - Effectiveness of previous CAPAs
   - Systemic issues uncovered

6. Trending and Metrics
   - Deviation rates over time
   - Time to closure metrics
   - Effectiveness of CAPAs
   - Areas with highest deviation rates

7. Quality Risk Assessment
   - Risk evaluation of open deviations
   - Potential impact on product quality
   - Regulatory risk assessment

8. Management Review
   - Key findings and insights
   - Resource requirements
   - Training needs identified
   - Recommendations for improvement

9. Regulatory Considerations
   - Reportability assessment
   - Compliance with GMP requirements
   - Audit trail and documentation

Provide thorough analysis with actionable recommendations.`
    }
];

export const Reporting: React.FC<ReportingProps> = ({ entities }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [mention, setMention] = useState<MentionState>({
        isActive: false,
        type: 'entity',
        query: '',
        top: 0,
        left: 0,
        triggerIndex: -1
    });

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on query
    const getSuggestions = () => {
        if (!mention.isActive) return [];

        const query = mention.query.toLowerCase();

        if (mention.type === 'entity') {
            return entities.filter(e =>
                e.name.toLowerCase().includes(query)
            );
        } else if (mention.type === 'attribute' && mention.entityContext) {
            return mention.entityContext.properties.filter(p =>
                p.name.toLowerCase().includes(query)
            );
        }
        return [];
    };

    const suggestions = getSuggestions();
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        setSelectedIndex(0);
    }, [mention.query, mention.type]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setPrompt(val);

        const cursor = e.target.selectionStart;

        // Check for triggers
        // 1. Entity Trigger: @
        // 2. Attribute Trigger: . (only if preceded by an entity name)

        // Look backwards from cursor
        const textBeforeCursor = val.slice(0, cursor);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            // Check if there's a space between @ and cursor (cancel mention)
            const textSinceAt = textBeforeCursor.slice(lastAt + 1);
            if (textSinceAt.includes(' ')) {
                setMention(prev => ({ ...prev, isActive: false }));
                return;
            }

            // Check for dot to switch to attribute mode
            const dotIndex = textSinceAt.indexOf('.');

            if (dotIndex !== -1) {
                // Potential attribute mention
                // Extract entity name: @EntityName.
                const entityName = textSinceAt.slice(0, dotIndex);
                const entity = entities.find(e => e.name === entityName);

                if (entity) {
                    const attrQuery = textSinceAt.slice(dotIndex + 1);
                    updateMentionPosition(cursor);
                    setMention({
                        isActive: true,
                        type: 'attribute',
                        query: attrQuery,
                        top: 0, // Updated by updateMentionPosition
                        left: 0,
                        triggerIndex: lastAt + 1 + dotIndex + 1, // Start of attribute query
                        entityContext: entity
                    });
                    return;
                }
            }

            // Entity mode
            updateMentionPosition(lastAt + 1);
            setMention({
                isActive: true,
                type: 'entity',
                query: textSinceAt,
                top: 0,
                left: 0,
                triggerIndex: lastAt + 1
            });
        } else {
            setMention(prev => ({ ...prev, isActive: false }));
        }
    };

    const updateMentionPosition = (cursorIndex: number) => {
        if (!textareaRef.current || !mirrorRef.current) return;

        const text = textareaRef.current.value;
        const textBefore = text.slice(0, cursorIndex);

        // Update mirror content
        mirrorRef.current.textContent = textBefore;

        // Create a span to measure position
        const span = document.createElement('span');
        span.textContent = '.';
        mirrorRef.current.appendChild(span);

        const rect = span.getBoundingClientRect();
        const textareaRect = textareaRef.current.getBoundingClientRect();

        setMention(prev => ({
            ...prev,
            top: rect.top - textareaRect.top + 24, // Offset
            left: rect.left - textareaRect.left
        }));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!mention.isActive) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (suggestions.length > 0) {
                selectSuggestion(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setMention(prev => ({ ...prev, isActive: false }));
        }
    };

    const selectSuggestion = (item: Entity | Property) => {
        if (!textareaRef.current) return;

        const text = prompt;
        let insertText = '';
        let newCursorPos = 0;

        if (mention.type === 'entity') {
            const entity = item as Entity;
            insertText = entity.name;

            const start = text.lastIndexOf('@', textareaRef.current.selectionStart);
            const end = textareaRef.current.selectionStart;

            const newText = text.slice(0, start) + '@' + insertText + text.slice(end);
            setPrompt(newText);
            newCursorPos = start + 1 + insertText.length;

        } else {
            const prop = item as Property;
            insertText = prop.name;

            const start = text.lastIndexOf('.', textareaRef.current.selectionStart);
            const end = textareaRef.current.selectionStart;

            const newText = text.slice(0, start) + '.' + insertText + text.slice(end);
            setPrompt(newText);
            newCursorPos = start + 1 + insertText.length;
        }

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);

        setMention(prev => ({ ...prev, isActive: false }));
    };

    const handleTemplateSelect = (template: ReportTemplate) => {
        setPrompt(template.prompt);
        setSelectedTemplate(template.id);
        // Focus on textarea after a short delay
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                // Optionally scroll to the textarea
                textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setReport(null);

        // Extract mentioned entity IDs from the prompt
        const mentionedIds = entities
            .filter(e => prompt.includes(`@${e.name}`))
            .map(e => e.id);

        try {
            const res = await fetch('http://localhost:3001/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mentionedEntityIds: mentionedIds
                })
            });

            const data = await res.json();
            if (data.error) {
                throw new Error(data.error);
            }
            setReport(data.response);
        } catch (error) {
            console.error('Error generating report:', error);
            setReport('Failed to generate report. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <Sparkles className="text-teal-600" size={24} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">AI Reporting</h1>
                        <p className="text-xs text-slate-500">Generate insights from your data</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-8">

                    {/* Templates Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="text-teal-600" size={20} />
                            <h2 className="text-lg font-semibold text-slate-800">Report Templates</h2>
                            <span className="text-xs text-slate-500 ml-auto">Select a template to get started</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reportTemplates.map((template) => {
                                const IconComponent = template.icon;
                                const isSelected = selectedTemplate === template.id;
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => handleTemplateSelect(template)}
                                        className={`group text-left p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${isSelected
                                                ? 'border-teal-500 bg-teal-50 shadow-md'
                                                : 'border-slate-200 bg-white hover:border-teal-300'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-600'
                                                }`}>
                                                <IconComponent size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-semibold text-sm mb-1 transition-colors ${isSelected ? 'text-teal-700' : 'text-slate-800 group-hover:text-teal-700'
                                                    }`}>
                                                    {template.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 line-clamp-2">
                                                    {template.description}
                                                </p>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="mt-3 flex items-center gap-1 text-xs text-teal-600 font-medium">
                                                <Sparkles size={12} />
                                                <span>Template loaded</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative group focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Draft your query
                        </label>
                        <div className="relative">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. Analyze the capacity of @Factories and list any issues..."
                                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:bg-white transition-colors text-slate-800 leading-relaxed"
                            />

                            {/* Suggestion Popover */}
                            {mention.isActive && suggestions.length > 0 && (
                                <div
                                    className="absolute z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                                    style={{
                                        top: mention.top,
                                        left: mention.left
                                    }}
                                >
                                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {mention.type === 'entity' ? 'Entities' : `Properties of ${mention.entityContext?.name}`}
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {suggestions.map((item, index) => (
                                            <button
                                                key={item.id}
                                                onClick={() => selectSuggestion(item)}
                                                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${index === selectedIndex
                                                    ? 'bg-teal-50 text-teal-700'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {mention.type === 'entity' ? (
                                                    <Database size={14} className="text-slate-400" />
                                                ) : (
                                                    <Hash size={14} className="text-slate-400" />
                                                )}
                                                <span>{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Mirror div for positioning */}
                            <div
                                ref={mirrorRef}
                                className="absolute top-0 left-0 w-full h-full p-4 pointer-events-none invisible whitespace-pre-wrap font-sans text-base leading-relaxed"
                            >
                                {prompt.slice(0, textareaRef.current?.selectionStart || 0)}
                                <span className="relative">|</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <div className="flex items-center space-x-4 text-xs text-slate-400">
                                <span className="flex items-center">
                                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5 font-sans">@</kbd>
                                    to mention entities
                                </span>
                                <span className="flex items-center">
                                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5 font-sans">.</kbd>
                                    for attributes
                                </span>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !prompt.trim()}
                                className="flex items-center px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} className="mr-2" />
                                        Generate Report
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Results Area */}
                    {report && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                                    <Sparkles className="text-teal-600" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Generated Insights</h2>
                                    <p className="text-sm text-slate-500">Based on your data context</p>
                                </div>
                            </div>
                            <div className="prose prose-slate max-w-none">
                                <ReactMarkdown>{report}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
