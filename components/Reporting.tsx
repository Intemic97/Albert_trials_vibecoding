import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Entity } from '../types';
import { Sparkles, FileText, FlaskConical, Clipboard, Wrench, AlertTriangle, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PromptInput } from './PromptInput';

interface ReportingProps {
    entities: Entity[];
}

interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    prompt: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
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
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [templatePrompt, setTemplatePrompt] = useState(''); // Store template prompt to pass to PromptInput

    const reportRef = useRef<HTMLDivElement>(null);

    const handleTemplateSelect = (template: ReportTemplate) => {
        setTemplatePrompt(template.prompt);
        setSelectedTemplate(template.id);
    };

    const handleGenerate = async (prompt: string, mentionedEntityIds: string[]) => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setReport(null);

        try {
            const res = await fetch('http://localhost:3001/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mentionedEntityIds
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

    const handleDownloadPDF = async () => {
        if (!reportRef.current || !report) return;

        try {
            // Create a temporary container with better styling for PDF
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.width = '210mm'; // A4 width
            tempContainer.style.padding = '20mm';
            tempContainer.style.backgroundColor = 'white';
            tempContainer.style.fontFamily = 'Arial, sans-serif';

            // Clone the report content
            const clonedReport = reportRef.current.cloneNode(true) as HTMLElement;
            tempContainer.appendChild(clonedReport);
            document.body.appendChild(tempContainer);

            // Generate canvas from the temporary container
            const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // Remove temporary container
            document.body.removeChild(tempContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Calculate dimensions to fit the page
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add additional pages if needed
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `report_${timestamp}.pdf`;

            pdf.save(filename);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
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

                        {/* Use Key to force re-render when template changes if needed, or just rely on manual input */}
                        <PromptInput
                            key={selectedTemplate} // Reset input when template changes (optional, but good for UX here)
                            entities={entities}
                            onGenerate={handleGenerate}
                            isGenerating={isLoading}
                            placeholder={templatePrompt || "e.g. Analyze the capacity of @Factories and list any issues..."}
                            buttonLabel="Generate Report"
                        />
                    </div>

                    {/* Results Area */}
                    {report && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                                    <Sparkles className="text-teal-600" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold text-slate-800">Generated Insights</h2>
                                    <p className="text-sm text-slate-500">Based on your data context</p>
                                </div>
                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium shadow-sm transition-all"
                                >
                                    <Download size={16} />
                                    Download PDF
                                </button>
                            </div>
                            <div ref={reportRef} className="prose prose-slate max-w-none">
                                <ReactMarkdown>{report}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
