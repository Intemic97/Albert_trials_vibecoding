# 🐍 Secure Python Execution Setup

This project now supports secure Python code execution using AWS Lambda containers.

## 🎯 Why Lambda?

**Before (Local execution):**
- ❌ Security risks (users can access file system, network, etc.)
- ❌ Resource abuse (infinite loops can crash server)
- ❌ Limited scalability

**After (AWS Lambda):**
- ✅ Isolated containers (each execution in separate environment)
- ✅ Automatic timeouts and resource limits
- ✅ Scales automatically to handle concurrent requests
- ✅ Only pay for what you use (~$20-30/month for normal usage)

## 📋 Quick Start

### Option 1: Use AWS Lambda (Recommended for Production)

1. **Install dependencies:**
   ```bash
   npm install @aws-sdk/client-lambda
   ```

2. **Follow setup guide:**
   - Read `AWS_LAMBDA_SETUP.md` for detailed instructions
   - Create Lambda function in AWS Console
   - Copy `lambda_function.py` to AWS Lambda
   - Configure environment variables

3. **Enable Lambda:**
   - Add AWS credentials to `server/.env` (see `ENV_TEMPLATE.txt`)
   - Set `USE_LAMBDA_FOR_PYTHON=true`
   - Restart server

### Option 2: Continue with Local Execution (Development Only)

- Keep `USE_LAMBDA_FOR_PYTHON=false` in `.env`
- Uses sandboxed local execution (less secure but works without AWS)

## 📁 Files Created

```
├── lambda_function.py          # AWS Lambda function code (deploy to AWS)
├── server/lambdaService.js     # Backend service to call Lambda
├── AWS_LAMBDA_SETUP.md         # Detailed setup instructions
├── ENV_TEMPLATE.txt            # Environment variables template
└── README_PYTHON_SETUP.md      # This file
```

## 🔧 Configuration

Add to your `server/.env`:
```env
USE_LAMBDA_FOR_PYTHON=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LAMBDA_FUNCTION_NAME=python-executor
```

## 🧪 Testing

### Test in AWS Console:
```json
{
  "code": "def process(data):\n    return [{'value': item['value'] * 2} for item in data]",
  "inputData": [{"value": 5}, {"value": 10}]
}
```

Expected result:
```json
{
  "success": true,
  "result": [{"value": 10}, {"value": 20}],
  "output": ""
}
```

### Test in your app:
1. Create Python node in workflow
2. Add code:
   ```python
   def process(data):
       return [{'value': item['value'] * 2} for item in data]
   ```
3. Connect to data source
4. Run workflow

## 💰 Costs

**AWS Lambda Free Tier (First 12 months):**
- 1,000,000 requests/month FREE
- 400,000 GB-seconds compute/month FREE

**After Free Tier:**
- $0.20 per 1M requests
- $0.0000166667 per GB-second
- **Estimated: $20-30/month for normal usage**

## 🔒 Security Features

✅ Isolated execution environment per request  
✅ No file system access  
✅ No network access (except allowed APIs)  
✅ Automatic timeout (30 seconds)  
✅ Memory limits (512 MB)  
✅ No access to host resources  

## 🐛 Troubleshooting

### "Missing credentials" error
- Check `.env` file has correct AWS keys
- Verify keys in AWS Console → IAM

### "Function not found" error
- Verify Lambda function name matches `LAMBDA_FUNCTION_NAME`
- Check AWS region is correct

### Falls back to local execution
- Lambda execution failed, check CloudWatch logs
- Verify AWS credentials are valid

## 📚 Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [AWS Free Tier](https://aws.amazon.com/free/)

## 🆘 Need Help?

1. Read `AWS_LAMBDA_SETUP.md` for step-by-step guide
2. Check CloudWatch logs in AWS Console
3. Test Lambda function directly in AWS Console first
4. Verify environment variables are set correctly

---

**Status:** 
- ✅ Lambda service created
- ✅ Lambda function code ready
- ⏳ AWS setup needed (follow AWS_LAMBDA_SETUP.md)
- ⏳ Configure environment variables
- ⏳ Test and deploy

