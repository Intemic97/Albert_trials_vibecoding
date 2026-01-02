/**
 * Local test script for Lambda service
 * Run with: node test-lambda-local.js
 * 
 * This tests the Lambda integration WITHOUT actually calling AWS
 */

// Mock Lambda response for local testing
const mockLambdaExecution = async (code, inputData) => {
    console.log('🧪 [Mock Lambda] Simulating Lambda execution...');
    console.log('Code length:', code.length);
    console.log('Input data:', JSON.stringify(inputData).substring(0, 100));
    
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For testing, just return doubled values
    const result = inputData.map(item => ({
        ...item,
        value: (item.value || 0) * 2
    }));
    
    return {
        success: true,
        result: result,
        output: 'Mock execution completed'
    };
};

// Test cases
const tests = [
    {
        name: 'Simple multiplication',
        code: `
def process(data):
    return [{'value': item['value'] * 2} for item in data]
`,
        inputData: [{ value: 5 }, { value: 10 }],
        expected: [{ value: 10 }, { value: 20 }]
    },
    {
        name: 'Filter and transform',
        code: `
def process(data):
    return [item for item in data if item['value'] > 5]
`,
        inputData: [{ value: 3 }, { value: 7 }, { value: 10 }],
        expected: [{ value: 7 }, { value: 10 }]
    }
];

async function runTests() {
    console.log('🚀 Starting Lambda Service Tests\n');
    
    for (const test of tests) {
        console.log(`\n📝 Test: ${test.name}`);
        console.log('=' .repeat(50));
        
        try {
            const result = await mockLambdaExecution(test.code, test.inputData);
            
            if (result.success) {
                console.log('✅ Success');
                console.log('Result:', JSON.stringify(result.result, null, 2));
            } else {
                console.log('❌ Failed:', result.error);
            }
        } catch (error) {
            console.log('❌ Error:', error.message);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 Next Steps:');
    console.log('1. Follow AWS_LAMBDA_SETUP.md to create Lambda function');
    console.log('2. Configure environment variables in server/.env');
    console.log('3. Set USE_LAMBDA_FOR_PYTHON=true');
    console.log('4. Restart server and test in your app');
}

runTests().catch(console.error);

