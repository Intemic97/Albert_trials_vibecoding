/**
 * AWS Lambda Service for secure Python execution
 * This service sends Python code to AWS Lambda for isolated execution
 */

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

// Initialize Lambda client
const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Execute Python code in AWS Lambda
 * @param {string} code - Python code to execute
 * @param {Array} inputData - Input data for the Python function
 * @returns {Object} - Execution result
 */
async function executePythonInLambda(code, inputData) {
    const payload = {
        code: code,
        inputData: inputData || []
    };

    const command = new InvokeCommand({
        FunctionName: process.env.LAMBDA_FUNCTION_NAME || 'python-executor',
        Payload: JSON.stringify(payload),
        InvocationType: 'RequestResponse' // Wait for response
    });

    try {
        console.log('[Lambda] Executing Python code...');
        const response = await lambdaClient.send(command);
        
        // Parse Lambda response
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        
        // Check if Lambda execution itself failed
        if (response.FunctionError) {
            throw new Error(`Lambda function error: ${response.FunctionError}`);
        }
        
        const body = JSON.parse(result.body);
        console.log('[Lambda] Execution completed:', body.success ? 'SUCCESS' : 'FAILED');
        
        // Log error details if execution failed
        if (!body.success) {
            console.log('[Lambda] Error details:', body.error);
            if (body.traceback) {
                console.log('[Lambda] Traceback:', body.traceback);
            }
        }
        
        return body;
    } catch (error) {
        console.error('[Lambda] Execution error:', error);
        throw new Error(`Lambda execution failed: ${error.message}`);
    }
}

/**
 * Execute Franmit Reactor Model in AWS Lambda
 * @param {string} funName - Function to call: 'solve_single_receta' or 'solve_recetas_parallel'
 * @param {Object} argsFun - Arguments for the function (receta, qins, reactor_configuration)
 * @returns {Object} - Execution result with outs and qouts
 */
async function executeFranmitInLambda(funName, argsFun) {
    const payload = {
        fun_name: funName,
        args_fun: argsFun
    };

    const command = new InvokeCommand({
        FunctionName: process.env.FRANMIT_LAMBDA_FUNCTION_NAME || 'franmit-reactor',
        Payload: JSON.stringify(payload),
        InvocationType: 'RequestResponse'
    });

    try {
        console.log('[Franmit Lambda] Executing reactor model...');
        const response = await lambdaClient.send(command);
        
        // Parse Lambda response
        const result = JSON.parse(Buffer.from(response.Payload).toString());
        
        // Check if Lambda execution itself failed
        if (response.FunctionError) {
            throw new Error(`Lambda function error: ${response.FunctionError}`);
        }
        
        const body = JSON.parse(result.body);
        console.log('[Franmit Lambda] Execution completed:', body.success ? 'SUCCESS' : 'FAILED');
        
        // Log error details if execution failed
        if (!body.success) {
            console.log('[Franmit Lambda] Error details:', body.error);
            if (body.traceback) {
                console.log('[Franmit Lambda] Traceback:', body.traceback);
            }
        }
        
        return body;
    } catch (error) {
        console.error('[Franmit Lambda] Execution error:', error);
        throw new Error(`Franmit Lambda execution failed: ${error.message}`);
    }
}

module.exports = { executePythonInLambda, executeFranmitInLambda };

