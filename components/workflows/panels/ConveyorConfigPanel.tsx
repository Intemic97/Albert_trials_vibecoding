/**
 * ConveyorConfigPanel
 * Extracted from Workflows.tsx lines 8366-8576
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Gear, Info, ChatText, WarningCircle } from '@phosphor-icons/react';

interface ConveyorConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const ConveyorConfigPanel: React.FC<ConveyorConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [conveyorSpeed, setConveyorSpeed] = useState(node?.config?.conveyorSpeed || '');
  const [conveyorLength, setConveyorLength] = useState(node?.config?.conveyorLength || '');
  const [conveyorWidth, setConveyorWidth] = useState(node?.config?.conveyorWidth || '');
  const [conveyorInclination, setConveyorInclination] = useState(node?.config?.conveyorInclination || '');
  const [conveyorLoadCapacity, setConveyorLoadCapacity] = useState(node?.config?.conveyorLoadCapacity || '');
  const [conveyorBeltType, setConveyorBeltType] = useState(node?.config?.conveyorBeltType || 'flat');
  const [conveyorMotorPower, setConveyorMotorPower] = useState(node?.config?.conveyorMotorPower || '');
  const [conveyorFrictionCoeff, setConveyorFrictionCoeff] = useState(node?.config?.conveyorFrictionCoeff || '');

  const handleSave = () => {
    onSave(nodeId, { conveyorSpeed, conveyorLength, conveyorWidth, conveyorInclination, conveyorLoadCapacity, conveyorBeltType, conveyorMotorPower, conveyorFrictionCoeff });
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Conveyor Belt"
        description="Industrial conveyor belt model"
        icon={Gear}
        width="w-[500px]"
        footer={
            <>
                <button
                    onClick={() => onClose()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!conveyorSpeed.trim() || !conveyorLength.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            {/* Required Inputs Info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
                    <WarningCircle size={14} />
                    Required Inputs
                </h4>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    This node requires <strong>Speed</strong> and <strong>Length</strong> to calculate transport dynamics.
                    Connect an upstream node providing input data, or configure the parameters below.
                </p>
            </div>

            {/* Required Parameters Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Required Parameters</h4>

                {/* Speed */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Belt Speed (m/s) <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={conveyorSpeed}
                        onChange={(e) => setConveyorSpeed(e.target.value)}
                        placeholder="e.g. 1.5"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Linear speed of the conveyor belt surface</p>
                </div>

                {/* Length */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Belt Length (m) <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={conveyorLength}
                        onChange={(e) => setConveyorLength(e.target.value)}
                        placeholder="e.g. 25"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Total distance from loading to discharge point</p>
                </div>
            </div>

            {/* Optional Parameters Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Physical Parameters</h4>

                {/* Width */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Belt Width (m)
                    </label>
                    <input
                        type="text"
                        value={conveyorWidth}
                        onChange={(e) => setConveyorWidth(e.target.value)}
                        placeholder="e.g. 0.8"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Inclination */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Inclination Angle (°)
                    </label>
                    <input
                        type="text"
                        value={conveyorInclination}
                        onChange={(e) => setConveyorInclination(e.target.value)}
                        placeholder="e.g. 15 (0 = horizontal)"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Angle of incline, 0° for horizontal conveyors</p>
                </div>

                {/* Load Capacity */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Max Load Capacity (kg/m)
                    </label>
                    <input
                        type="text"
                        value={conveyorLoadCapacity}
                        onChange={(e) => setConveyorLoadCapacity(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Maximum material load per meter of belt</p>
                </div>

                {/* Belt Type */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Belt Type
                    </label>
                    <select
                        value={conveyorBeltType}
                        onChange={(e) => setConveyorBeltType(e.target.value)}
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] bg-[var(--bg-card)]"
                    >
                        <option value="flat">Flat Belt</option>
                        <option value="troughed">Troughed Belt</option>
                        <option value="cleated">Cleated Belt</option>
                        <option value="modular">Modular Belt</option>
                        <option value="roller">Roller Conveyor</option>
                    </select>
                </div>
            </div>

            {/* Motor & Mechanical Section */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3 text-center">Motor & Mechanical</h4>

                {/* Motor Power */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Motor Power (kW)
                    </label>
                    <input
                        type="text"
                        value={conveyorMotorPower}
                        onChange={(e) => setConveyorMotorPower(e.target.value)}
                        placeholder="e.g. 7.5"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Friction Coefficient */}
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Friction Coefficient (μ)
                    </label>
                    <input
                        type="text"
                        value={conveyorFrictionCoeff}
                        onChange={(e) => setConveyorFrictionCoeff(e.target.value)}
                        placeholder="e.g. 0.025"
                        className="w-full px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Belt-to-idler friction coefficient (typical: 0.02–0.03)</p>
                </div>
            </div>

            {/* Calculated Outputs Info */}
            <div className="border-t border-[var(--border-light)] pt-4">
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2 text-center">Calculated Outputs</h4>
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Transport time (s) — Time for material to travel the full belt length
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Throughput (t/h) — Material mass flow rate
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Required power (kW) — Estimated drive power needed
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Belt tension (N) — Effective belt tension force
                    </div>
                </div>
            </div>

            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('conveyor', 'Conveyor Belt')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
