# AWS Lambda Deployment Guide for Python Executor

## Prerequisites
1. AWS Account (create at https://aws.amazon.com)
2. AWS CLI installed
3. Basic AWS knowledge

## Step-by-Step Deployment

### 1. Install AWS SDK
```bash
npm install @aws-sdk/client-lambda
```

### 2. Configure AWS Credentials

#### Option A: Using AWS CLI (Recommended)
```bash
# Install AWS CLI if not installed
# Windows: https://aws.amazon.com/cli/
# Mac: brew install awscli
# Linux: sudo apt-get install awscli

# Configure credentials
aws configure
# Enter:
# - AWS Access Key ID: [Your key]
# - AWS Secret Access Key: [Your secret]
# - Default region: us-east-1
# - Default output format: json
```

#### Option B: Manual Setup
1. Go to AWS Console → IAM → Users → Create User
2. Attach policy: `AWSLambdaFullAccess`
3. Create access key
4. Save credentials

### 3. Create Lambda Function in AWS Console

1. **Go to AWS Lambda Console**
   - URL: https://console.aws.amazon.com/lambda

2. **Create Function**
   - Click "Create function"
   - Choose "Author from scratch"
   - Function name: `python-executor`
   - Runtime: `Python 3.11`
   - Architecture: `x86_64`
   - Click "Create function"

3. **Upload Code**
   - In the Code tab, delete the default code
   - Copy the entire content of `lambda_function.py` from this project
   - Paste it into the Lambda editor
   - Click "Deploy"

4. **Configure Function**
   - Go to "Configuration" → "General configuration"
   - Click "Edit"
   - Set:
     - Memory: `512 MB`
     - Timeout: `30 seconds`
   - Click "Save"

5. **Set Concurrency (Optional but recommended)**
   - Go to "Configuration" → "Concurrency"
   - Set "Reserved concurrent executions": `100`
   - This prevents runaway costs

### 4. Get Function ARN
- In the Lambda function page, copy the **Function ARN**
- It looks like: `arn:aws:lambda:us-east-1:123456789:function:python-executor`

### 5. Configure Backend Environment Variables

Add to `server/.env`:
```env
# AWS Lambda Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
LAMBDA_FUNCTION_NAME=python-executor

# Optional: Enable Lambda execution
USE_LAMBDA_FOR_PYTHON=true
```

### 6. Test the Lambda Function

**Test in AWS Console:**
1. In Lambda console, click "Test"
2. Create new test event:
```json
{
  "code": "def process(data):\n    return [{'value': item['value'] * 2} for item in data]",
  "inputData": [{"value": 5}, {"value": 10}]
}
```
3. Click "Test" - should return success with doubled values

**Test from your app:**
1. Restart your backend server
2. Create a Python node in a workflow
3. Add code:
```python
def process(data):
    return [{'value': item['value'] * 2} for item in data]
```
4. Run the workflow

### 7. Monitor and Costs

**View Logs:**
- Go to Lambda → Monitor → View logs in CloudWatch
- All executions are logged here

**View Costs:**
- Go to AWS Console → Billing Dashboard
- Lambda costs are shown separately

**Free Tier:**
- 1M requests/month free
- 400,000 GB-seconds/month free
- Good for ~80,000 executions/month with 512MB/5s avg

### 8. Security Best Practices

1. **IAM Policy** (Create restricted policy):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:us-east-1:*:function:python-executor"
    }
  ]
}
```

2. **Rotate Keys Regularly**: Change AWS access keys every 90 days

3. **Enable CloudTrail**: Track all Lambda invocations

## Troubleshooting

### Error: "Missing credentials"
- Check `.env` file has correct AWS keys
- Verify keys are valid in AWS Console

### Error: "Function not found"
- Check `LAMBDA_FUNCTION_NAME` matches exactly
- Verify function exists in correct region

### Error: "Timeout"
- Increase timeout in Lambda configuration
- Check if code has infinite loops

### Error: "Rate exceeded"
- You hit Lambda concurrent execution limit
- Increase reserved concurrency

## Alternative: Docker (If you prefer self-hosted)

If you don't want to use AWS:
1. Contact me to implement Docker-based solution
2. Requires Docker installed on your server
3. More complex but fully self-hosted

## Support

If you encounter issues:
1. Check CloudWatch logs in AWS Console
2. Verify environment variables are set
3. Test Lambda function directly in AWS Console first
4. Check AWS region matches everywhere

