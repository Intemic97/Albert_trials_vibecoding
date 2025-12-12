// Workflow Runner Helper Functions
export const extractManualInputs = (nodes: any[]) => {
    const inputNodes = nodes.filter(n => n.type === 'manualInput');
    const initialInputs: { [nodeId: string]: string } = {};

    inputNodes.forEach(node => {
        initialInputs[node.id] = node.config?.inputVarValue || '';
    });

    return initialInputs;
};

export const extractOutputs = (nodes: any[]) => {
    const outputNodes = nodes.filter(n => n.type === 'output');
    const outputs: { [nodeId: string]: any } = {};

    outputNodes.forEach((node) => {
        outputs[node.id] = {
            data: node.outputData || null,
            label: node.label
        };
    });

    return outputs;
};
