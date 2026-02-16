/**
 * AI & Code Execution Routes
 * 
 * Handles: Python execution, Franmit, debug, code generation,
 * widget generation, workflow generation, workflow assistant.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pdfParse = require('pdf-parse');
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db }) {

    const uploadsDir = path.join(__dirname, '..', 'uploads');

    // Helper to resolve relation values
    async function resolveRelationValue(db, value, relatedEntityId) {
        if (!value || !relatedEntityId) return value;
        try {
            let ids = [];
            try { const parsed = JSON.parse(value); ids = Array.isArray(parsed) ? parsed : [value]; } catch { ids = [value]; }
            const names = [];
            for (const id of ids) {
                const relatedValues = await db.all('SELECT * FROM record_values WHERE recordId = ?', [id]);
                if (relatedValues.length === 0) { names.push(id); continue; }
                const relatedProps = await db.all('SELECT * FROM properties WHERE entityId = ?', [relatedEntityId]);
                let nameVal = null;
                const nameProp = relatedProps.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
                if (nameProp) { const valRow = relatedValues.find(rv => rv.propertyId === nameProp.id); if (valRow) nameVal = valRow.value; }
                if (!nameVal) { const textProp = relatedProps.find(p => p.type === 'text'); if (textProp) { const valRow = relatedValues.find(rv => rv.propertyId === textProp.id); if (valRow) nameVal = valRow.value; } }
                names.push(nameVal || id);
            }
            return names.length === 1 ? names[0] : names.join(', ');
        } catch (e) { console.error('Error resolving relation value:', e); return value; }
    }

    // Helper function to extract text from files
    async function extractFileContent(filename) {
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) return null;
        const ext = path.extname(filename).toLowerCase();
        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                return { type: 'pdf', text: data.text, pages: data.numpages, info: data.info };
            } else if (ext === '.txt' || ext === '.csv') {
                const text = fs.readFileSync(filePath, 'utf8');
                return { type: ext.slice(1), text };
            } else {
                return { type: ext.slice(1), text: null, message: 'Text extraction not supported for this file type' };
            }
        } catch (error) {
            console.error('Error extracting file content:', error);
            return { type: ext.slice(1), text: null, error: error.message };
        }
    }

    // Helper: sanitize widget config from LLM output
function sanitizeWidgetConfig(rawConfig) {
    const cfg = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const data = Array.isArray(cfg.data) ? cfg.data.filter(row => row && typeof row === 'object') : [];
    const first = data[0] || {};
    const keys = Object.keys(first);
    const firstStringKey = keys.find((k) => typeof first[k] === 'string') || 'name';
    const firstNumericKey = keys.find((k) => Number.isFinite(Number(first[k]))) || 'value';
    const type = SUPPORTED_WIDGET_TYPES.has(cfg.type) ? cfg.type : 'bar';

    const sanitized = {
        type,
        title: typeof cfg.title === 'string' && cfg.title.trim() ? cfg.title.trim() : 'AI Widget',
        description: typeof cfg.description === 'string' ? cfg.description : '',
        explanation: typeof cfg.explanation === 'string' ? cfg.explanation : '',
        data,
        xAxisKey: typeof cfg.xAxisKey === 'string' && cfg.xAxisKey ? cfg.xAxisKey : firstStringKey,
        dataKey: typeof cfg.dataKey === 'string' || Array.isArray(cfg.dataKey) ? cfg.dataKey : firstNumericKey,
        colors: Array.isArray(cfg.colors) ? cfg.colors.filter(c => typeof c === 'string') : undefined
    };

    if (type === 'heatmap') {
        sanitized.yKey = typeof cfg.yKey === 'string' && cfg.yKey ? cfg.yKey : 'category';
        sanitized.valueKey = typeof cfg.valueKey === 'string' && cfg.valueKey
            ? cfg.valueKey
            : (typeof sanitized.dataKey === 'string' ? sanitized.dataKey : firstNumericKey);
    }

    if (type === 'bubble') {
        sanitized.yKey = typeof cfg.yKey === 'string' && cfg.yKey
            ? cfg.yKey
            : (typeof sanitized.dataKey === 'string' ? sanitized.dataKey : firstNumericKey);
        sanitized.sizeKey = typeof cfg.sizeKey === 'string' && cfg.sizeKey ? cfg.sizeKey : 'size';
    }

    if (type === 'sankey') {
        const links = Array.isArray(cfg.links)
            ? cfg.links.filter((l) => l && l.source && l.target).map((l) => ({
                source: String(l.source),
                target: String(l.target),
                value: Number(l.value) || 0
            }))
            : data
                .map((d) => ({
                    source: d.source || d.from || '',
                    target: d.target || d.to || '',
                    value: Number(d.value) || 0
                }))
                .filter((l) => l.source && l.target);
        const nodes = Array.isArray(cfg.nodes)
            ? cfg.nodes.filter((n) => n && n.id).map((n) => ({ id: String(n.id), value: Number(n.value) || undefined }))
            : Array.from(new Set(links.flatMap((l) => [l.source, l.target]))).map((id) => ({ id }));
        sanitized.links = links;
        sanitized.nodes = nodes;
        sanitized.valueKey = typeof cfg.valueKey === 'string' && cfg.valueKey ? cfg.valueKey : 'value';
    }

    if (type === 'timeline') {
        sanitized.events = Array.isArray(cfg.events)
            ? cfg.events
            : data.map((d) => ({
                start: d.start || d.date || d.timestamp || d.time,
                end: d.end,
                severity: d.severity || 'medium',
                label: d.label || d.name || ''
            }));
    }

    if (type === 'multi_timeline') {
        sanitized.tracks = Array.isArray(cfg.tracks) ? cfg.tracks : undefined;
        sanitized.colorKey = typeof cfg.colorKey === 'string' && cfg.colorKey ? cfg.colorKey : 'asset';
    }

    return sanitized;
}


router.post('/python/execute', authenticateToken, async (req, res) => {
    const { code, inputData } = req.body;
    
    // Check if Lambda is configured
    const useLambda = process.env.USE_LAMBDA_FOR_PYTHON === 'true' && 
                     process.env.AWS_ACCESS_KEY_ID && 
                     process.env.LAMBDA_FUNCTION_NAME;
    
    if (useLambda) {
        // Use AWS Lambda for execution (secure, isolated)
        try {
            const { executePythonInLambda } = require('../lambdaService');
            console.log('[Python] Using AWS Lambda for execution');
            
            const result = await executePythonInLambda(code, inputData);
            
            if (result.success) {
                // Log result details for debugging
                const resultType = result.result === null ? 'null' : 
                                   result.result === undefined ? 'undefined' :
                                   Array.isArray(result.result) ? `array[${result.result.length}]` :
                                   typeof result.result;
                console.log(`[Python Lambda] Result type: ${resultType}`);
                
                if (result.result === null || result.result === undefined) {
                    console.warn('[Python Lambda] Warning: process() returned null/undefined');
                }
                
                res.json({
                    success: true,
                    output: result.output || '',
                    result: result.result,
                    resultType: resultType // Include type info for debugging
                });
            } else {
                res.json({
                    success: false,
                    error: result.error || 'Execution failed',
                    traceback: result.traceback
                });
            }
            return;
        } catch (error) {
            console.error('[Python Lambda] Execution error:', error);
            // Fall back to local execution if Lambda fails
            console.log('[Python] Lambda failed, falling back to local execution');
        }
    }
    
    // Fallback: Local execution with sandboxing (less secure)
    console.log('[Python] Using local sandboxed execution');
    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');
    const crypto = require('crypto');

    // Timeout in seconds
    const EXECUTION_TIMEOUT = 30;

    try {
        // Escape user code safely - convert to base64 to avoid any injection
        const codeBase64 = Buffer.from(code || '').toString('base64');
        
        // Create a secure wrapper script
        const wrapperCode = `
import json
import sys
import ast
import base64
import signal

# ============== TIMEOUT HANDLER ==============
class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timed out (${EXECUTION_TIMEOUT}s limit)")

# Set timeout (Unix only, Windows will skip this)
try:
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(${EXECUTION_TIMEOUT})
except:
    pass  # Windows doesn't support SIGALRM

# ============== SECURITY CHECKS ==============
def check_security(code_str):
    try:
        tree = ast.parse(code_str)
    except SyntaxError as e:
        return f"Syntax Error: {e}"

    # Allowed safe imports (whitelist approach)
    allowed_imports = {
        'json', 'math', 're', 'datetime', 'collections', 'itertools',
        'functools', 'decimal', 'fractions', 'random', 'statistics',
        'string', 'copy', 'operator', 'numbers', 'time', 'calendar',
        'heapq', 'bisect', 'array', 'enum', 'typing', 'dataclasses',
        'csv', 'hashlib', 'hmac', 'base64', 'binascii', 'struct',
        'codecs', 'unicodedata', 'difflib', 'textwrap', 'pprint',
        # Data processing libraries (commonly needed)
        'urllib', 'html', 'xml', 'warnings', 'logging', 'uuid',
        'pickle', 'shelve', 'sqlite3', 'zlib', 'gzip', 'bz2',
        # Numeric/Scientific (if installed)
        'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn',
        # Others
        'io', 'pathlib', 'glob', 'fnmatch', 'linecache', 'shutil'
    }
    
    # Expanded forbidden functions/names
    forbidden_names = {
        'open', 'exec', 'eval', 'compile', '__import__', 'input', 
        'breakpoint', 'help', 'exit', 'quit',
        '__build_class__', '__loader__', '__spec__', '__builtins__', 
        '__cached__', '__doc__', '__file__', '__name__', '__package__'
    }
    
    # Forbidden attribute access patterns
    forbidden_attrs = {
        '__class__', '__bases__', '__subclasses__', '__mro__', '__dict__',
        '__globals__', '__code__', '__closure__', '__func__', '__self__',
        '__reduce__', '__reduce_ex__', '__getinitargs__', '__getnewargs__',
        '__getstate__', '__setstate__', 'gi_frame', 'gi_code', 'f_globals',
        'f_locals', 'f_builtins', 'co_code', 'func_globals', 'func_code'
    }

    for node in ast.walk(tree):
        # Check imports - whitelist approach
        if isinstance(node, ast.Import):
            for alias in node.names:
                module_base = alias.name.split('.')[0]
                if module_base not in allowed_imports:
                    return f"Security Error: Import of '{alias.name}' is not allowed. Allowed: {', '.join(sorted(allowed_imports))}"
        
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module_base = node.module.split('.')[0]
                if module_base not in allowed_imports:
                    return f"Security Error: Import from '{node.module}' is not allowed. Allowed: {', '.join(sorted(allowed_imports))}"
        
        # Check function calls and name access
        elif isinstance(node, ast.Name):
            if node.id in forbidden_names:
                return f"Security Error: Access to '{node.id}' is not allowed"
        
        # Check attribute access - only block dangerous dunder methods
        elif isinstance(node, ast.Attribute):
            if node.attr in forbidden_attrs:
                return f"Security Error: Access to '{node.attr}' is not allowed"

    return None

# ============== SAFE BUILTINS ==============
SAFE_BUILTINS = {
    'True': True,
    'False': False,
    'None': None,
    'abs': abs,
    'all': all,
    'any': any,
    'bin': bin,
    'bool': bool,
    'chr': chr,
    'dict': dict,
    'divmod': divmod,
    'enumerate': enumerate,
    'filter': filter,
    'float': float,
    'format': format,
    'frozenset': frozenset,
    'hash': hash,
    'hex': hex,
    'int': int,
    'isinstance': isinstance,
    'issubclass': issubclass,
    'iter': iter,
    'len': len,
    'list': list,
    'map': map,
    'max': max,
    'min': min,
    'next': next,
    'oct': oct,
    'ord': ord,
    'pow': pow,
    'print': print,
    'range': range,
    'repr': repr,
    'reversed': reversed,
    'round': round,
    'set': set,
    'slice': slice,
    'sorted': sorted,
    'str': str,
    'sum': sum,
    'tuple': tuple,
    'zip': zip,
    # Math functions (safe)
    'complex': complex,
}

# ============== DECODE AND EXECUTE ==============
try:
    # Decode user code from base64
    user_code = base64.b64decode("${codeBase64}").decode('utf-8')
    
    # Run security check
    security_error = check_security(user_code)
    if security_error:
        print(json.dumps({"error": security_error}))
        sys.exit(0)
    
    # Create restricted globals
    restricted_globals = {
        '__builtins__': SAFE_BUILTINS,
        'json': json,  # Allow json for data processing
        'math': __import__('math'),  # Allow math module
        're': __import__('re'),  # Allow regex
        'datetime': __import__('datetime'),  # Allow datetime
        'collections': __import__('collections'),  # Allow collections
        'itertools': __import__('itertools'),  # Allow itertools
        'functools': __import__('functools'),  # Allow functools
        'decimal': __import__('decimal'),  # Allow decimal
        'fractions': __import__('fractions'),  # Allow fractions
        'random': __import__('random'),  # Allow random
        'statistics': __import__('statistics'),  # Allow statistics
        'string': __import__('string'),  # Allow string
        'copy': __import__('copy'),  # Allow copy
    }
    restricted_locals = {}
    
    # Execute user code in restricted environment
    exec(user_code, restricted_globals, restricted_locals)
    
    # Read input from stdin
    input_data = json.load(sys.stdin)
    
    # Execute user function (must be named 'process')
    if 'process' in restricted_locals:
        result = restricted_locals['process'](input_data)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Function 'process(data)' not found. Please define: def process(data): ..."}))

except TimeoutError as e:
    print(json.dumps({"error": str(e)}))
except MemoryError:
    print(json.dumps({"error": "Memory limit exceeded"}))
except Exception as e:
    print(json.dumps({"error": f"Runtime Error: {str(e)}"}))
finally:
    # Cancel alarm
    try:
        signal.alarm(0)
    except:
        pass
`;

        // Write to temp file with random name to prevent race conditions
        const tempFile = path.join(__dirname, `sandbox_${crypto.randomBytes(8).toString('hex')}.py`);
        fs.writeFileSync(tempFile, wrapperCode);

        // Execute python script
        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
        console.log('Executing Python (sandboxed) with command:', pythonCommand);

        const pythonProcess = spawn(pythonCommand, [tempFile]);

        // Set up Node.js level timeout as backup
        const processTimeout = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            console.error('Python process killed due to timeout');
        }, (EXECUTION_TIMEOUT + 5) * 1000);

        pythonProcess.on('error', (err) => {
            clearTimeout(processTimeout);
            console.error('Failed to start python process:', err);
        });

        let stdoutData = '';
        let stderrData = '';

        // Send input data to stdin - normalize to array if single object (e.g. from webhook)
        const normalizedInput = Array.isArray(inputData) ? inputData : (inputData ? [inputData] : []);
        pythonProcess.stdin.write(JSON.stringify(normalizedInput));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            // Limit output size to prevent memory exhaustion
            if (stdoutData.length < 10 * 1024 * 1024) { // 10MB limit
                stdoutData += data.toString();
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            if (stderrData.length < 1024 * 1024) { // 1MB limit
                stderrData += data.toString();
            }
        });

        pythonProcess.on('close', (code) => {
            clearTimeout(processTimeout);
            
            // Cleanup temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.error('Error deleting temp file:', e);
            }

            if (code !== 0 && !stdoutData) {
                return res.status(500).json({ error: stderrData || 'Python execution failed' });
            }

            try {
                const result = JSON.parse(stdoutData);
                if (result.error) {
                    return res.status(400).json({ error: result.error });
                }
                res.json({ result });
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse Python output: ' + stdoutData.substring(0, 500) });
            }
        });

    } catch (error) {
        console.error('Error executing Python:', error);
        res.status(500).json({ error: 'Internal server error during execution' });
    }
});

// Franmit Reactor Execution Endpoint - Local Python Execution
router.post('/franmit/execute', authenticateToken, async (req, res) => {
    const { mode, receta, recetas, qins, reactorConfiguration } = req.body;

    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');
    const platform = require('os').platform();

    // Sanitize NaN/null/Infinity values from integration outputs
    function sanitizeNaNValues(obj, depth = 0) {
        if (depth > 50) return obj;
        if (obj === null || obj === undefined) return 0;
        if (typeof obj === 'number') {
            if (isNaN(obj) || !isFinite(obj)) return 0;
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeNaNValues(item, depth + 1));
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const key of Object.keys(obj)) {
                sanitized[key] = sanitizeNaNValues(obj[key], depth + 1);
            }
            return sanitized;
        }
        return obj;
    }

    // Pre-process raw Python stdout to fix NaN/Infinity tokens before JSON.parse
    function sanitizeJsonString(rawStr) {
        return rawStr
            .replace(/\bNaN\b/g, '0')
            .replace(/\b-Infinity\b/g, '0')
            .replace(/\bInfinity\b/g, '0');
    }

    try {
        const isBatch = mode === 'batch' && Array.isArray(recetas) && recetas.length > 0;
        console.log(`[Franmit] Executing reactor model locally (mode: ${isBatch ? 'batch' : 'single'}, rows: ${isBatch ? recetas.length : 1})`);
        
        // Build input data for Python script
        const zeros8 = [0, 0, 0, 0, 0, 0, 0, 0];
        const defaultQins = {
            'Q_H2o': 0, 'Q_Hxo': 0,
            'Q_Po': [...zeros8], 'Q_Yo': [...zeros8], 'Q_Y1': [...zeros8],
            'Q_To': [...zeros8], 'Q_T1': [...zeros8], 'Q_T2': [...zeros8],
        };
        
        const inputData = isBatch
            ? {
                mode: 'batch',
                recetas: recetas,
                reactor_configuration: reactorConfiguration || { V_reb: 53, scale_cat: 1 },
                qins: qins || defaultQins
            }
            : {
                mode: 'single',
                receta: receta || {},
                reactor_configuration: reactorConfiguration || { V_reb: 53, scale_cat: 1 },
                qins: qins || defaultQins
            };
        
        console.log('[Franmit] Input data:', JSON.stringify(inputData).substring(0, 400));

        // Path to Python script
        const scriptPath = path.join(__dirname, 'franmit_model.py');
        
        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({
                success: false,
                error: `Franmit model script not found at ${scriptPath}`
            });
        }

        // Determine Python command
        const pythonCmd = platform === 'win32' ? 'py' : 'python3';
        
        // Execute Python script
        const pythonProcess = spawn(pythonCmd, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Send input data as JSON
        pythonProcess.stdin.write(JSON.stringify(inputData));
        pythonProcess.stdin.end();

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        // Set timeout (90 seconds for reactor model - ODE integration can be slow)
        const timeout = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            return res.status(500).json({
                success: false,
                error: 'Franmit execution timed out (90s limit)'
            });
        }, 90000);

        pythonProcess.on('close', (code) => {
            clearTimeout(timeout);
            
            // Log stderr warnings (numpy RuntimeWarnings are expected)
            if (stderrData) {
                console.log('[Franmit] Python stderr (warnings):', stderrData.substring(0, 500));
            }

            try {
                // Pre-process: replace NaN/Infinity tokens with 0 before JSON.parse
                const sanitizedStdout = sanitizeJsonString(stdoutData);
                const result = JSON.parse(sanitizedStdout);
                
                if (result.success) {
                    // Python returns { success, results: [...], errors: [] }
                    // results is an array of output rows (one per input receta)
                    const sanitizedResults = sanitizeNaNValues(result.results || []);
                    
                    if (result.errors && result.errors.length > 0) {
                        console.log('[Franmit] Some rows had errors:', result.errors);
                    }
                    
                    console.log(`[Franmit] Reactor model completed: ${sanitizedResults.length} result(s)`);
                    res.json({
                        success: true,
                        results: sanitizedResults,
                        errors: result.errors || [],
                        display: ''
                    });
                } else {
                    console.log('[Franmit] Model returned error:', result.error);
                    res.json({
                        success: false,
                        error: result.error || 'Franmit execution failed',
                        traceback: result.traceback,
                        display: result.error || ''
                    });
                }
            } catch (parseError) {
                if (code !== 0) {
                    console.error('[Franmit] Python process error (code ' + code + '):', stderrData || stdoutData);
                    res.status(500).json({
                        success: false,
                        error: stderrData || stdoutData || 'Franmit execution failed',
                        traceback: stderrData
                    });
                } else {
                    console.error('[Franmit] Failed to parse output:', parseError);
                    console.error('[Franmit] Raw stdout:', stdoutData.substring(0, 500));
                    res.status(500).json({
                        success: false,
                        error: 'Failed to parse Franmit output',
                        rawOutput: stdoutData.substring(0, 500)
                    });
                }
            }
        });

        pythonProcess.on('error', (error) => {
            clearTimeout(timeout);
            console.error('[Franmit] Failed to start Python process:', error);
            res.status(500).json({
                success: false,
                error: `Failed to execute Python: ${error.message}. Make sure Python 3 with numpy/scipy is installed.`
            });
        });

    } catch (error) {
        console.error('[Franmit] Execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Franmit execution failed'
        });
    }
});

// Python Debug Endpoint - AI analyzes error and suggests fix
router.post('/debug-python-code', authenticateToken, async (req, res) => {
    const { code, error, inputDataSample } = req.body;

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API Key not configured' });
    }

    if (!code || !error) {
        return res.status(400).json({ error: 'Code and error are required' });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context about input data if available
        let inputContext = '';
        if (inputDataSample && inputDataSample.length > 0) {
            inputContext = `\n\nSample input data (first ${inputDataSample.length} records):\n${JSON.stringify(inputDataSample, null, 2)}`;
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a Python debugging expert. Analyze the code and error, then provide a fixed version.

Your response MUST be valid JSON with this structure:
{
    "explanation": "Brief explanation of what was wrong and how you fixed it",
    "fixedCode": "The complete fixed Python code"
}

RULES:
1. The code must define a function called "process" that takes "data" as parameter
2. The function must return the processed data (array of objects or single object)
3. Keep the same general logic but fix the error
4. If using numpy/pandas/scipy, make sure imports are correct
5. Return ONLY the JSON, no markdown formatting`
                },
                {
                    role: "user",
                    content: `Please fix this Python code:

=== ORIGINAL CODE ===
${code}

=== ERROR MESSAGE ===
${error}
${inputContext}

Analyze the error and provide the fixed code.`
                }
            ],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log('[Python Debug] AI suggestion:', result.explanation);
        
        res.json({
            fixedCode: result.fixedCode,
            explanation: result.explanation
        });

    } catch (error) {
        console.error('Error debugging Python code:', error);
        res.status(500).json({ error: 'Failed to debug code' });
    }
});

// Python Code Generation Endpoint
router.post('/python/generate', authenticateToken, async (req, res) => {
    const { prompt, inputDataSchema } = req.body;

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API Key not configured' });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context about input data if available
        let inputDataContext = '';
        if (inputDataSchema && inputDataSchema.columns && inputDataSchema.columns.length > 0) {
            console.log('Python Generate - Input Schema:', JSON.stringify(inputDataSchema));
            inputDataContext = `

CRITICAL - INPUT DATA STRUCTURE:
The input data contains records with these EXACT column names: ${inputDataSchema.columns.map(c => `"${c}"`).join(', ')}
You MUST use these EXACT column names in your code. Do NOT translate, rename, or modify them in any way.
For example, if the column is "temperatura_celsius", use exactly "temperatura_celsius", NOT "temperature_celsius".`;
            
            if (inputDataSchema.sampleData && inputDataSchema.sampleData.length > 0) {
                inputDataContext += `
Sample input data: ${JSON.stringify(inputDataSchema.sampleData)}`;
            }
        } else {
            console.log('Python Generate - No input schema provided');
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a Python code generator. Your ONLY job is to output Python code. NEVER output explanations, comments outside code, or any text that is not valid Python code.

STRICT RULES:
1. Output ONLY valid Python code - nothing else.
2. Start with any necessary imports (like: import json, import math, etc.)
3. Define a function named exactly: def process(data):
4. The function receives 'data' which is a list of dictionaries (records).
5. The function MUST return the modified list.
6. Do NOT include markdown formatting (no \`\`\`python or \`\`\`).
7. Do NOT include any explanations or text outside the code.${inputDataContext}

EXAMPLE OUTPUT FORMAT:
import json

def process(data):
    for record in data:
        # your logic here
        pass
    return data`
                },
                { role: "user", content: `Generate Python code to: ${prompt}` }
            ],
            model: "gpt-4o",
        });

        let code = completion.choices[0].message.content;

        // Strip markdown if present (just in case)
        code = code.replace(/```python/g, '').replace(/```/g, '').trim();

        res.json({ code });

    } catch (error) {
        console.error('Error generating Python code:', error);
        res.status(500).json({ error: 'Failed to generate code' });
    }
});

// OpenAI Widget Generation Endpoint
const SUPPORTED_WIDGET_TYPES = new Set([
    'bar',
    'line',
    'pie',
    'area',
    'donut',
    'radial',
    'gauge',
    'parallel',
    'heatmap',
    'scatter_matrix',
    'sankey',
    'bubble',
    'timeline',
    'multi_timeline'
]);

router.post('/generate-widget', authenticateToken, async (req, res) => {
    console.log('Received widget generation request');
    try {
        const { prompt, mentionedEntityIds, entityContext, forceRealData } = req.body;
        console.log('Widget Prompt:', prompt);
        console.log('Entity IDs:', mentionedEntityIds?.length || 0, 'entities');

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // If no entities provided, fetch ALL entities from the organization
        let entityIdsToUse = mentionedEntityIds || [];
        if (entityIdsToUse.length === 0) {
            console.log('No entities mentioned, fetching all organization entities...');
            const allEntities = await db.all('SELECT id FROM entities WHERE organizationId = ?', [req.user.orgId]);
            entityIdsToUse = allEntities.map(e => e.id);
            console.log('Found', entityIdsToUse.length, 'entities in organization');
        }

        // 1. Fetch data context (Reuse logic - ideally refactor into function)
        let contextData = {};
        if (entityIdsToUse && entityIdsToUse.length > 0) {
            const entityPromises = entityIdsToUse.map(async (entityId) => {
                const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
                if (!entity) return null;
                const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);
                const records = await db.all('SELECT * FROM records WHERE entityId = ? LIMIT 50', [entityId]);
                const recordsWithValues = await Promise.all(records.map(async (r) => {
                    const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [r.id]);
                    const valuesMap = {};

                    await Promise.all(values.map(async v => {
                        const prop = properties.find(p => p.id === v.propertyId);
                        const key = prop ? prop.name : v.propertyId;

                        let value = v.value;
                        if (prop && prop.type === 'relation' && prop.relatedEntityId) {
                            value = await resolveRelationValue(db, v.value, prop.relatedEntityId);
                        } else if (prop && prop.type === 'file' && v.value) {
                            // Extract file content for file type properties
                            try {
                                const fileData = JSON.parse(v.value);
                                if (fileData && fileData.filename) {
                                    const fileContent = await extractFileContent(fileData.filename);
                                    if (fileContent && fileContent.text) {
                                        value = {
                                            filename: fileData.originalName || fileData.filename,
                                            content: fileContent.text.substring(0, 50000)
                                        };
                                    } else {
                                        value = {
                                            filename: fileData.originalName || fileData.filename,
                                            content: '[File content could not be extracted]'
                                        };
                                    }
                                }
                            } catch (e) {
                                console.error('Error processing file value:', e);
                            }
                        }

                        valuesMap[key] = value;
                    }));

                    return { id: r.id, ...valuesMap };
                }));
                return {
                    name: entity.name,
                    data: { properties: properties.map(p => ({ name: p.name, type: p.type })), records: recordsWithValues }
                };
            });
            const results = await Promise.all(entityPromises);
            results.forEach(result => { if (result) contextData[result.name] = result.data; });

            // Fetch related entities (both outgoing and incoming relations)
            const relatedEntityIds = new Set();
            
            for (const entityId of entityIdsToUse) {
                const relationProps = await db.all(
                    'SELECT relatedEntityId FROM properties WHERE entityId = ? AND type = ? AND relatedEntityId IS NOT NULL',
                    [entityId, 'relation']
                );
                relationProps.forEach(p => relatedEntityIds.add(p.relatedEntityId));
            }

            for (const entityId of entityIdsToUse) {
                const incomingProps = await db.all(
                    'SELECT DISTINCT entityId FROM properties WHERE type = ? AND relatedEntityId = ?',
                    ['relation', entityId]
                );
                incomingProps.forEach(p => relatedEntityIds.add(p.entityId));
            }

            entityIdsToUse.forEach(id => relatedEntityIds.delete(id));

            if (relatedEntityIds.size > 0) {
                const relatedPromises = Array.from(relatedEntityIds).map(async (entityId) => {
                    const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
                    if (!entity) return null;

                    const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);
                    const records = await db.all('SELECT * FROM records WHERE entityId = ? LIMIT 50', [entityId]);

                    const recordsWithValues = await Promise.all(records.map(async (r) => {
                        const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [r.id]);
                        const valuesMap = {};

                        await Promise.all(values.map(async v => {
                            const prop = properties.find(p => p.id === v.propertyId);
                            const key = prop ? prop.name : v.propertyId;
                            let value = v.value;
                            if (prop && prop.type === 'relation' && prop.relatedEntityId) {
                                value = await resolveRelationValue(db, v.value, prop.relatedEntityId);
                            }
                            valuesMap[key] = value;
                        }));

                        return { id: r.id, ...valuesMap };
                    }));

                    return {
                        name: entity.name,
                        data: { properties: properties.map(p => ({ name: p.name, type: p.type })), records: recordsWithValues }
                    };
                });

                const relatedResults = await Promise.all(relatedPromises);
                relatedResults.forEach(result => {
                    if (result && !contextData[result.name]) {
                        contextData[result.name] = result.data;
                    }
                });
            }
        }

        // 2. Call OpenAI for Widget Config
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Check if we have real data to work with
        const hasRealData = Object.keys(contextData).length > 0;
        if (!hasRealData) {
            console.warn('No data context available for widget generation');
            return res.status(400).json({ 
                error: 'No data available. Please ensure you have entities with records in your database.' 
            });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a data visualization expert. You MUST ONLY use data from the provided context - NEVER invent, fabricate, or estimate data.

CRITICAL RULES:
1. ONLY use the actual data provided in the context below. Do NOT make up any values.
2. If the data doesn't contain what the user is asking for, explain what data IS available.
3. All values in your output MUST come directly from the provided records.
4. Do NOT extrapolate, estimate, or create fictional data points.

DATA CONTEXT (USE ONLY THIS DATA):
${JSON.stringify(contextData, null, 2)}

Based on the user's prompt and ONLY the data above, generate a JSON configuration for a chart.

The JSON structure MUST be:
{
    "type": "bar" | "line" | "pie" | "area",
    "title": "Chart Title",
    "description": "Brief description",
    "explanation": "A detailed explanation of how this chart was prepared. Structure it as two paragraphs separated by a double newline (\\n\\n). First paragraph: A natural language description of the logic. Second paragraph: Start with 'I executed the following technical query:' followed by pseudo-code steps. IMPORTANT: In the Technical Query, you MUST use the EXACT names of the Entities and Properties from the provided context (e.g., 'Filter @Equipment where Status=Active'). Do not use generic terms.",
    "data": [ { "name": "Label", "value": 123, ... } ],
    "xAxisKey": "name",
    "dataKey": "value" (or array of keys for multiple lines/areas),
    "colors": ["#hex", ...] (optional custom colors)
}

REMEMBER: Every data point must come from the actual records in the context. Never invent data.
Return ONLY the valid JSON string, no markdown formatting.`
                },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        const widgetConfig = JSON.parse(completion.choices[0].message.content);
        res.json(sanitizeWidgetConfig(widgetConfig));

    } catch (error) {
        console.error('Error generating widget:', error);
        res.status(500).json({ error: 'Failed to generate widget' });
    }
});

// Generate Widget from Direct Data (for Workflow nodes)
router.post('/generate-widget-from-data', authenticateToken, async (req, res) => {
    console.log('Received widget generation request from workflow data');
    try {
        const { prompt, data } = req.body;
        console.log('Widget Prompt:', prompt);
        console.log('Data records:', Array.isArray(data) ? data.length : 'not an array');

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
            return res.status(400).json({ error: 'No data provided for visualization' });
        }

        // Prepare context with data schema and sample
        const dataArray = Array.isArray(data) ? data : [data];
        const sampleData = dataArray.slice(0, 10); // First 10 records as sample
        const fields = Object.keys(dataArray[0] || {});
        
        const dataContext = {
            totalRecords: dataArray.length,
            fields: fields,
            sampleRecords: sampleData,
            fullData: dataArray.slice(0, 100) // Limit to 100 records for processing
        };

        // Call OpenAI for Widget Config
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a data visualization expert.
            You have access to the following data:
            - Total records: ${dataContext.totalRecords}
            - Available fields: ${fields.join(', ')}
            - Sample data: ${JSON.stringify(dataContext.sampleRecords, null, 2)}
            - Full data (up to 100 records): ${JSON.stringify(dataContext.fullData)}
            
            Based on the user's prompt, generate a JSON configuration for a chart.
            IMPORTANT: You must transform/aggregate the provided data as needed to create meaningful visualizations.
            
            The JSON structure MUST be:
            {
                "type": "bar" | "line" | "pie" | "area",
                "title": "Chart Title",
                "description": "Brief description",
                "explanation": "A detailed explanation of how this chart was prepared. Structure it as two paragraphs separated by a double newline (\\n\\n). First paragraph: A natural language description of the logic and what the chart shows. Second paragraph: Start with 'Technical approach:' followed by how you processed the data.",
                "data": [ { "name": "Label", "value": 123, ... } ],
                "xAxisKey": "name",
                "dataKey": "value" (or array of keys for multiple lines/areas),
                "colors": ["#hex", ...] (optional custom colors)
            }
            
            CRITICAL RULES:
            1. The "data" array should contain the TRANSFORMED/AGGREGATED data ready for charting, NOT the raw input data
            2. For bar/line/area charts, ensure data has proper labels (xAxisKey) and numeric values (dataKey)
            3. For pie charts, ensure data has "name" field and a numeric value field
            4. If the user asks for aggregations (sum, count, average, group by), calculate them
            5. Ensure the data is aggregated or formatted correctly for the chosen chart type
            6. Return ONLY the valid JSON string, no markdown formatting.`
                },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        const widgetConfig = JSON.parse(completion.choices[0].message.content);
        const sanitizedWidgetConfig = sanitizeWidgetConfig(widgetConfig);
        console.log('Generated widget config:', sanitizedWidgetConfig.title);
        res.json(sanitizedWidgetConfig);

    } catch (error) {
        console.error('Error generating widget from data:', error);
        res.status(500).json({ error: error.message || 'Failed to generate widget' });
    }
});

// AI Workflow Generation Endpoint
router.post('/generate-workflow', authenticateToken, async (req, res) => {
    console.log('Received workflow generation request');
    try {
        const { prompt, entities } = req.body;
        console.log('Workflow Prompt:', prompt);

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // Build entity context for the AI
        const entityContext = entities.map(e => ({
            id: e.id,
            name: e.name,
            properties: e.properties.map(p => ({ name: p.name, type: p.type }))
        }));

        const systemPrompt = `You are an AI assistant that generates workflow configurations. You must output ONLY valid JSON, no explanations.

Available node types and their configurations:

1. **trigger** - Start the workflow
   - label: "Manual Trigger" or "Schedule"

2. **fetchData** - Get records from a database entity
   - config: { selectedEntityId: "entity-uuid", selectedEntityName: "EntityName" }

3. **condition** - If/Else branching (has two outputs: true and false)
   - config: { conditionField: "fieldName", conditionOperator: "equals|notEquals|contains|greaterThan|lessThan", conditionValue: "value" }

4. **join** - Combine data from two sources (has two inputs: A and B)
   - config: { joinStrategy: "concat|mergeByKey", joinKey: "fieldName" }

5. **addField** - Add a new field to each record
   - config: { fieldName: "newField", fieldValue: "value or expression" }

6. **llm** - Generate text using AI
   - config: { prompt: "AI prompt text" }

7. **python** - Run Python code
   - config: { code: "python code here" }

8. **http** - Make HTTP request
   - config: { url: "https://...", method: "GET|POST" }

9. **manualInput** - Define a variable
   - config: { variableName: "name", variableValue: "value" }

10. **saveRecords** - Save data to database
    - config: { targetEntityId: "entity-uuid", targetEntityName: "EntityName", fieldMappings: {} }

11. **output** - Display results
    - label: "Output" or custom label

12. **humanApproval** - Wait for user approval
    - label: "Human Approval"

13. **esios** - Fetch energy prices from Red Eléctrica
    - config: { indicator: "indicator-id" }

14. **climatiq** - Search CO2 emission factors
    - config: { searchQuery: "activity description" }

15. **excelInput** - Load data from Excel or CSV file
    - config: { fileName: "file.xlsx" } (file must be uploaded via node configuration)

User's available entities:
${JSON.stringify(entityContext, null, 2)}

RULES:
1. Always start with a "trigger" node at x=150
2. Space nodes horizontally by 280px (x: 150, 430, 710, 990...)
3. Keep y position around 250 for main flow
4. For condition nodes, branch true path at y=200, false path at y=400
5. Generate unique IDs using format: "node_1", "node_2", etc.
6. Connection IDs use format: "conn_1", "conn_2", etc.
7. For condition connections, specify outputType: "true" or "false"
8. For join connections, specify inputPort: "A" or "B"
9. Match entity names/IDs from the provided entities list when using fetchData or saveRecords

Output format:
{
  "nodes": [
    { "id": "node_1", "type": "trigger", "label": "Manual Trigger", "x": 150, "y": 250 },
    { "id": "node_2", "type": "fetchData", "label": "Fetch Customers", "x": 430, "y": 250, "config": { "selectedEntityId": "uuid", "selectedEntityName": "Customers" } }
  ],
  "connections": [
    { "id": "conn_1", "fromNodeId": "node_1", "toNodeId": "node_2" }
  ]
}`;

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Create a workflow for: ${prompt}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        const workflowData = JSON.parse(completion.choices[0].message.content);
        console.log('Generated workflow:', JSON.stringify(workflowData, null, 2));
        res.json(workflowData);

    } catch (error) {
        console.error('Error generating workflow:', error);
        res.status(500).json({ error: 'Failed to generate workflow' });
    }
});

// AI Workflow Assistant Chat Endpoint
router.post('/workflows/assistant/chat', authenticateToken, async (req, res) => {
    console.log('[Workflow AI Chat] Request received');
    try {
        const { message, workflowId, workflowName, nodes, connections, entities } = req.body;
        
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        console.log('[Workflow AI Chat] Message:', message);
        console.log('[Workflow AI Chat] Workflow:', workflowName, '- Nodes:', nodes.length, '- Connections:', connections.length);

        // Build context about the current workflow
        const workflowContext = {
            name: workflowName,
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                label: n.label,
                config: n.config
            })),
            connections: connections.map(c => ({
                from: c.fromNodeId,
                to: c.toNodeId,
                outputType: c.outputType,
                inputPort: c.inputPort
            })),
            entities: entities.map(e => ({
                id: e.id,
                name: e.name,
                properties: e.properties
            }))
        };

        const systemPrompt = `You are an AI workflow assistant. You help users build and modify automation workflows.

Current Workflow Context:
${JSON.stringify(workflowContext, null, 2)}

Available node types:
- trigger: Start workflow (Manual or Schedule)
- fetchData: Get records from database
- condition: If/Else branching (outputs: true/false)
- join: Combine data from two sources (inputs: A/B)
- addField: Add field to records
- llm: AI text generation
- python: Run Python code
- http: HTTP request
- manualInput: Define variable
- saveRecords: Save to database
- output: Display results
- humanApproval: Wait for approval
- excelInput: Load Excel/CSV
- pdfInput: Extract PDF text
- splitColumns: Split data by columns
- mysql: Query MySQL database
- sendEmail: Send email
- webhook: Receive external data

When the user asks to add nodes or modify the workflow:
1. Respond with a friendly explanation of what you're suggesting
2. Include a "suggestion" object with the workflow modification

Response format when suggesting workflow changes:
{
  "message": "I'll add a Fetch Data node to get customer records...",
  "suggestion": {
    "type": "nodes",
    "description": "Add Fetch Data node for customers",
    "nodes": [
      {
        "id": "node_new_1",
        "type": "fetchData",
        "label": "Fetch Customers",
        "x": 430,
        "y": 250,
        "config": { "selectedEntityId": "uuid", "selectedEntityName": "Customers" }
      }
    ],
    "connections": [
      {
        "id": "conn_new_1",
        "fromNodeId": "existing_node_id",
        "toNodeId": "node_new_1"
      }
    ]
  }
}

Response format for general questions (no workflow changes):
{
  "message": "Your response here..."
}

IMPORTANT:
- Only include "suggestion" when the user wants to ADD or MODIFY nodes
- For questions or explanations, just return "message"
- Position new nodes thoughtfully (consider existing node positions)
- Generate unique IDs for new nodes/connections
- Always respond in JSON format`;

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);
        console.log('[Workflow AI Chat] Response:', aiResponse.message);
        
        if (aiResponse.suggestion) {
            console.log('[Workflow AI Chat] Suggestion type:', aiResponse.suggestion.type);
        }

        // Save the prompt as feedback for admin review
        try {
            const feedbackId = Math.random().toString(36).substr(2, 9);
            const createdAt = new Date().toISOString();
            
            await db.run(`
                INSERT INTO node_feedback (id, nodeType, nodeLabel, feedbackText, userId, userName, userEmail, organizationId, workflowId, workflowName, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                feedbackId,
                'ai_assistant',
                'Workflow AI Assistant',
                message,
                req.user.sub,
                req.user.name || '',
                req.user.email || '',
                req.user.orgId,
                workflowId || null,
                workflowName || null,
                createdAt
            ]);
            
            console.log('[Workflow AI Chat] Prompt saved to feedback');
        } catch (feedbackError) {
            console.error('[Workflow AI Chat] Error saving feedback:', feedbackError);
            // Don't fail the request if feedback save fails
        }

        res.json(aiResponse);

    } catch (error) {
        console.error('[Workflow AI Chat] Error:', error);
        res.status(500).json({ error: 'Failed to process AI chat message' });
    }
});

// AI Entity Schema Generation Endpoint
router.post('/generate-entity-schema', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;

        if (!description || typeof description !== 'string') {
            return res.status(400).json({ error: 'A description is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `You are a data-modelling assistant. Given a plain-language description of what the user wants to track, generate a JSON object with:
- "name": a short entity name (2-3 words max)
- "properties": an array of property objects, each with:
  - "name": the column/field name (concise, Title Case)
  - "type": one of "text", "number", "date", "url", "file", "select", "multi-select", "relation"
  - "unit": optional string for numeric fields (e.g. "kg", "°C", "m³/h")

Guidelines:
- Always include a "Name" property first (type: text)
- Generate between 4-8 relevant properties
- Choose the most appropriate type for each property
- Use "select" for fields that would have a fixed set of options (e.g. Status, Priority, Category)
- Use "number" for quantitative data and include units when applicable
- Use "date" for temporal fields
- Output ONLY valid JSON, no markdown, no explanations`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Create an entity schema for: ${description}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        const schema = JSON.parse(completion.choices[0].message.content);
        res.json(schema);

    } catch (error) {
        console.error('Error generating entity schema:', error);
        res.status(500).json({ error: 'Failed to generate entity schema' });
    }
});

// Dashboard Management Endpoints

    return router;
};
