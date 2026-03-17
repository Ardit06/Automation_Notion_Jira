# 🚀 Minikube Quick Start Guide

Complete guide for testing the Notion-Jira automation locally using Minikube.

## Why Minikube?

Minikube allows you to test your Kubernetes deployment locally before deploying to GKE. This is perfect for:
- ✅ Testing configuration changes
- ✅ Debugging issues locally
- ✅ Developing new features
- ✅ Learning Kubernetes

---

## Quick Start (3 Steps)

### Step 1: Setup Minikube

```bash
# Run the setup script (installs Minikube if needed)
./k8s/setup-minikube.sh
```

This script will:
- Install Minikube (if not already installed)
- Install kubectl (if not already installed)
- Start Minikube cluster
- Configure kubectl to use Minikube

### Step 2: Deploy Application

```bash
# Deploy to Minikube
./k8s/deploy-minikube.sh
```

This script will:
- Build Docker image locally
- Create Kubernetes secrets from your `.env` file
- Deploy the application
- Create a service to expose it
- Test the deployment

### Step 3: Access the Service

```bash
# Get the service URL
minikube service notion-jira-automation --url

# Or open in browser
minikube service notion-jira-automation
```

---

## Manual Setup (If Scripts Don't Work)

### 1. Start Minikube

```bash
# Start Minikube
minikube start --driver=docker --cpus=2 --memory=4096

# Verify it's running
minikube status
```

### 2. Configure Docker

```bash
# Use Minikube's Docker daemon
eval $(minikube docker-env)

# Verify
docker ps
```

### 3. Build Image

```bash
# Build the Docker image
docker build -t notion-jira-automation:latest .

# Verify image exists
docker images | grep notion-jira-automation
```

### 4. Create Secrets

```bash
# Create secret from .env file
kubectl create secret generic notion-jira-secrets --from-env-file=.env

# Verify secret was created
kubectl get secrets
```

### 5. Deploy Application

```bash
# Apply deployment
kubectl apply -f k8s/deployment-minikube.yaml

# Apply service
kubectl apply -f k8s/service-minikube.yaml

# Check status
kubectl get pods
kubectl get services
```

### 6. Access the Service

```bash
# Get service URL
minikube service notion-jira-automation --url

# Test health endpoint
curl $(minikube service notion-jira-automation --url)/webhook/health
```

---

## Testing

### Test Health Endpoint

```bash
SERVICE_URL=$(minikube service notion-jira-automation --url)
curl $SERVICE_URL/webhook/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-19T18:00:00.000Z",
  "version": "1.0.0"
}
```

### Test Connections

```bash
curl $SERVICE_URL/webhook/test
```

Expected response:
```json
{
  "notion": true,
  "jira": true
}
```

### Test with a Notion Page

```bash
# Replace with your actual page ID
curl -X POST $SERVICE_URL/webhook/test-page \
  -H "Content-Type: application/json" \
  -d '{
    "pageId": "your-page-id-here"
  }'
```

---

## Viewing Logs

```bash
# View logs
kubectl logs -l app=notion-jira-automation

# Follow logs in real-time
kubectl logs -f -l app=notion-jira-automation

# View logs from specific pod
kubectl get pods  # Get pod name
kubectl logs <pod-name>
```

---

## Debugging

### Pod Not Starting

```bash
# Check pod status
kubectl get pods

# Describe pod for details
kubectl describe pod -l app=notion-jira-automation

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### Image Not Found

```bash
# Make sure you're using Minikube's Docker daemon
eval $(minikube docker-env)

# Rebuild image
docker build -t notion-jira-automation:latest .

# Verify image exists
docker images | grep notion-jira-automation
```

### Service Not Accessible

```bash
# Check service
kubectl get service notion-jira-automation

# Get service URL
minikube service notion-jira-automation --url

# Check endpoints
kubectl get endpoints notion-jira-automation
```

---

## Useful Commands

```bash
# Minikube
minikube status                  # Check status
minikube dashboard               # Open Kubernetes dashboard
minikube service list            # List all services
minikube logs                    # View Minikube logs
minikube stop                    # Stop Minikube
minikube delete                  # Delete Minikube cluster

# kubectl
kubectl get pods                 # List pods
kubectl get services             # List services
kubectl get deployments          # List deployments
kubectl describe pod <name>      # Pod details
kubectl logs <pod-name>          # View logs
kubectl exec -it <pod> -- /bin/sh  # Shell into pod
kubectl delete pod <name>        # Delete pod (will restart)

# Restart deployment
kubectl rollout restart deployment notion-jira-automation

# Scale deployment
kubectl scale deployment notion-jira-automation --replicas=2
```

---

## Updating Your Code

After making code changes:

```bash
# 1. Configure Docker for Minikube
eval $(minikube docker-env)

# 2. Rebuild image
docker build -t notion-jira-automation:latest .

# 3. Restart deployment
kubectl rollout restart deployment notion-jira-automation

# 4. Watch rollout
kubectl rollout status deployment notion-jira-automation

# 5. Check logs
kubectl logs -f -l app=notion-jira-automation
```

---

## Setting Up Webhook with Minikube

Since Minikube runs locally, you need to expose it to the internet for Notion webhooks.

### Option 1: Using localtunnel

```bash
# Install localtunnel
npm install -g localtunnel

# Get Minikube service port
SERVICE_URL=$(minikube service notion-jira-automation --url)
PORT=$(echo $SERVICE_URL | cut -d':' -f3)

# Create tunnel
lt --port $PORT --subdomain ardit-jira-sync
```

Use the provided URL in Notion webhook configuration.

### Option 2: Using ngrok

```bash
# Install ngrok from https://ngrok.com/

# Get Minikube service port
SERVICE_URL=$(minikube service notion-jira-automation --url)
PORT=$(echo $SERVICE_URL | cut -d':' -f3)

# Create tunnel
ngrok http $PORT
```

Use the provided HTTPS URL in Notion webhook configuration.

---

## Cleanup

```bash
# Delete deployment and service
kubectl delete -f k8s/deployment-minikube.yaml
kubectl delete -f k8s/service-minikube.yaml

# Delete secrets
kubectl delete secret notion-jira-secrets

# Stop Minikube
minikube stop

# Delete Minikube cluster (removes everything)
minikube delete
```

---

## Troubleshooting

### "Connection refused" errors

```bash
# Restart Minikube
minikube stop
minikube start

# Reconfigure kubectl
kubectl config use-context minikube
```

### "ImagePullBackOff" errors

This means the deployment is trying to pull from a registry. Make sure you're using the Minikube deployment file:

```bash
kubectl apply -f k8s/deployment-minikube.yaml  # NOT deployment.yaml
```

### Secrets not found

```bash
# Recreate secrets
kubectl delete secret notion-jira-secrets
kubectl create secret generic notion-jira-secrets --from-env-file=.env
```

---

## Next Steps

Once everything works in Minikube:

1. ✅ Test all features locally
2. ✅ Verify Notion and Jira connections
3. ✅ Test webhook functionality (with tunnel)
4. 🚀 Deploy to GKE using `./k8s/deploy.sh`

---

## Comparison: Minikube vs GKE

| Feature | Minikube | GKE |
|---------|----------|-----|
| **Purpose** | Local testing | Production deployment |
| **Cost** | Free | Paid (GCP charges) |
| **Access** | localhost/tunnel | Public IP |
| **Resources** | Limited by your machine | Scalable |
| **Persistence** | Temporary | Persistent |
| **Use Case** | Development & testing | Production workloads |

---

## Support

For issues:
1. Check logs: `kubectl logs -l app=notion-jira-automation`
2. Check pod status: `kubectl get pods`
3. Check Minikube status: `minikube status`
4. View events: `kubectl get events`
