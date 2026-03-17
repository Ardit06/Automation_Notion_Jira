# 🚀 Kubernetes Deployment Guide - Notion-Jira Automation

Complete guide for deploying the Notion-Jira automation service to Google Kubernetes Engine (GKE).

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Setup Tools](#step-1-setup-tools)
- [Step 2: Connect to Cluster](#step-2-connect-to-cluster)
- [Step 3: Build and Push Docker Image](#step-3-build-and-push-docker-image)
- [Step 4: Test Docker Image](#step-4-test-docker-image)
- [Step 5: Create Secrets](#step-5-create-secrets)
- [Step 6: Deploy Application](#step-6-deploy-application)
- [Step 7: Verify Deployment](#step-7-verify-deployment)
- [Step 8: Configure Notion Webhook](#step-8-configure-notion-webhook)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Google Cloud Platform (GCP) account with access to project `arhm-206818`
- ✅ GKE cluster `arhm-cluster-2` in region `us-east1`
- ✅ Docker installed locally
- ✅ `gcloud` CLI installed and authenticated
- ✅ All Notion and Jira credentials ready

---

## Step 1: Setup Tools

### Install kubectl

```bash
# Download kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/$(uname | tr '[:upper:]' '[:lower:]')/amd64/kubectl"

# Make it executable
chmod +x kubectl

# Move to system path
sudo mv kubectl /usr/local/bin/

# Verify installation
kubectl version --client
```

Expected output:
```
Client Version: v1.x.x
```

### Verify Docker

```bash
docker --version
```

Expected output:
```
Docker version 24.x.x
```

If Docker is not installed:
- **Mac**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: Follow [official Docker installation guide](https://docs.docker.com/engine/install/)

---

## Step 2: Connect to Cluster

### Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set the project
gcloud config set project arhm-206818

# Verify project
gcloud config get-value project
```

### Get Cluster Credentials

```bash
# Connect to the GKE cluster
gcloud container clusters get-credentials arhm-cluster-2 --region us-east1

# Verify connection
kubectl cluster-info
kubectl get nodes
```

Expected output:
```
NAME                                          STATUS   ROLES    AGE   VERSION
gke-arhm-cluster-2-default-pool-xxxxx-xxxx   Ready    <none>   Xd    v1.x.x
```

---

## Step 3: Build and Push Docker Image

### Configure Docker for GCP Artifact Registry

```bash
# Authenticate Docker with GCP
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Build Docker Image

```bash
# Navigate to project directory
cd /Users/ardit/Automation_Jira_Notion

# Build the Docker image
docker build -t notion-jira-automation:latest .

# Verify the image was created
docker images | grep notion-jira-automation
```

### Tag and Push to Artifact Registry

```bash
# Tag the image for GCP Artifact Registry
docker tag notion-jira-automation:latest \
  us-central1-docker.pkg.dev/arhm-206818/notion-jira/notion-jira-automation:latest

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/arhm-206818/notion-jira/notion-jira-automation:latest
```

Expected output:
```
The push refers to repository [us-central1-docker.pkg.dev/arhm-206818/notion-jira/notion-jira-automation]
...
latest: digest: sha256:xxxxx size: xxxx
```

---

## Step 4: Test Docker Image

Before deploying with real credentials, test that the image works in the cluster.

### Apply Test Pod

```bash
# Apply the test pod
kubectl apply -f k8s/test-pod.yaml

# Check pod status
kubectl get pods

# View pod logs
kubectl logs notion-jira-test-pod

# Follow logs in real-time
kubectl logs -f notion-jira-test-pod
```

Expected log output:
```
Server running on port 3003
Environment: development
Notion User Stories Database ID: test_db_id_...
Jira Project Key: TEST
```

### Cleanup Test Pod

```bash
# Delete the test pod
kubectl delete pod notion-jira-test-pod
```

---

## Step 5: Create Secrets

### Prepare Your Credentials

Create a file called `secrets.env` with your actual values:

```bash
# Create secrets file (DO NOT commit this file!)
cat > secrets.env << 'EOF'
NOTION_API_KEY=secret_your_notion_api_key_here
NOTION_USER_STORIES_DATABASE_ID=your_32_char_database_id_without_hyphens
NOTION_EPICS_DATABASE_ID=your_32_char_database_id_without_hyphens
NOTION_WEBHOOK_SECRET=your_webhook_secret_from_notion
JIRA_BASE_URL=https://91life.atlassian.net
JIRA_EMAIL=your-email@91.life
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=HAR
SCRUM_MASTER_EMAILS=email1@91.life,email2@91.life
EOF
```

### Create Kubernetes Secret

```bash
# Create the secret from the file
kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env

# Verify the secret was created
kubectl get secrets

# View secret details (values will be base64 encoded)
kubectl describe secret notion-jira-secrets
```

### Secure the Secrets File

```bash
# IMPORTANT: Delete the secrets file after creating the secret
rm secrets.env

# Verify it's deleted
ls -la secrets.env  # Should show "No such file or directory"
```

---

## Step 6: Deploy Application

### Apply Deployment

```bash
# Apply the deployment
kubectl apply -f k8s/deployment.yaml

# Check deployment status
kubectl get deployments

# Check pod status
kubectl get pods
```

Expected output:
```
NAME                                     READY   STATUS    RESTARTS   AGE
notion-jira-automation-xxxxxxxxxx-xxxxx  1/1     Running   0          30s
```

### Expose the Service

```bash
# Apply the service
kubectl apply -f k8s/service.yaml

# Check service status
kubectl get services

# Get the external IP (may take a few minutes)
kubectl get service notion-jira-automation -w
```

Wait until `EXTERNAL-IP` changes from `<pending>` to an actual IP address:
```
NAME                     TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)        AGE
notion-jira-automation   LoadBalancer   10.x.x.x        34.x.x.x        80:xxxxx/TCP   2m
```

---

## Step 7: Verify Deployment

### Check Pod Logs

```bash
# View logs
kubectl logs -l app=notion-jira-automation

# Follow logs in real-time
kubectl logs -f -l app=notion-jira-automation
```

Expected log output:
```
Server running on port 3003
Environment: production
Notion User Stories Database ID: xxxxx
Notion Epics Database ID: xxxxx
Jira Project Key: HAR
```

### Test Health Endpoint

```bash
# Get the external IP
EXTERNAL_IP=$(kubectl get service notion-jira-automation -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl http://$EXTERNAL_IP/webhook/health
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
# Test Notion and Jira connections
curl http://$EXTERNAL_IP/webhook/test
```

Expected response:
```json
{
  "notion": true,
  "jira": true
}
```

---

## Step 8: Configure Notion Webhook

### Get Your Webhook URL

```bash
# Get the external IP
kubectl get service notion-jira-automation

# Your webhook URL will be:
# http://<EXTERNAL-IP>/webhook/notion
```

### Configure in Notion

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Select your integration
3. Go to **Webhooks** → **New webhook**
4. Configure:
   - **URL**: `http://<EXTERNAL-IP>/webhook/notion`
   - **Events**: `page.created`, `page.updated`
   - **Databases**: Select User Stories and Epics databases
5. Save and verify

### Test Webhook

1. Create a test page in Notion User Stories database
2. Set status to "Ready For Dev"
3. Check logs:
   ```bash
   kubectl logs -f -l app=notion-jira-automation | grep webhook
   ```
4. Verify issue was created in Jira

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl get pods

# Describe pod for events
kubectl describe pod -l app=notion-jira-automation

# Check logs
kubectl logs -l app=notion-jira-automation
```

Common issues:
- **ImagePullBackOff**: Docker image not found in registry
- **CrashLoopBackOff**: Application error, check logs
- **Pending**: Resource constraints, check cluster capacity

### Secret Issues

```bash
# Verify secret exists
kubectl get secret notion-jira-secrets

# Check secret keys
kubectl describe secret notion-jira-secrets

# Delete and recreate if needed
kubectl delete secret notion-jira-secrets
kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env
```

### Connection Issues

```bash
# Test from within the cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://notion-jira-automation:3003/webhook/health

# Check service endpoints
kubectl get endpoints notion-jira-automation
```

### View All Resources

```bash
# List all resources
kubectl get all -l app=notion-jira-automation

# Get detailed information
kubectl describe deployment notion-jira-automation
kubectl describe service notion-jira-automation
```

---

## Maintenance

### Update Deployment

```bash
# After making code changes:

# 1. Rebuild and push image
docker build -t notion-jira-automation:latest .
docker tag notion-jira-automation:latest \
  us-central1-docker.pkg.dev/arhm-206818/notion-jira/notion-jira-automation:latest
docker push us-central1-docker.pkg.dev/arhm-206818/notion-jira/notion-jira-automation:latest

# 2. Restart deployment to pull new image
kubectl rollout restart deployment notion-jira-automation

# 3. Check rollout status
kubectl rollout status deployment notion-jira-automation

# 4. Verify new pods are running
kubectl get pods
```

### Update Secrets

```bash
# Delete old secret
kubectl delete secret notion-jira-secrets

# Create new secret
kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env

# Restart deployment to use new secrets
kubectl rollout restart deployment notion-jira-automation
```

### Scale Deployment

```bash
# Scale to 2 replicas
kubectl scale deployment notion-jira-automation --replicas=2

# Verify
kubectl get pods
```

### View Logs

```bash
# Recent logs
kubectl logs -l app=notion-jira-automation --tail=100

# Follow logs
kubectl logs -f -l app=notion-jira-automation

# Logs from specific pod
kubectl logs <pod-name>

# Previous pod logs (if crashed)
kubectl logs <pod-name> --previous
```

### Delete Deployment

```bash
# Delete all resources
kubectl delete -f k8s/deployment.yaml
kubectl delete -f k8s/service.yaml
kubectl delete secret notion-jira-secrets

# Verify deletion
kubectl get all -l app=notion-jira-automation
```

---

## Monitoring

### Check Resource Usage

```bash
# Pod resource usage
kubectl top pods -l app=notion-jira-automation

# Node resource usage
kubectl top nodes
```

### Set Up Alerts (Optional)

Consider setting up Google Cloud Monitoring alerts for:
- Pod restarts
- High memory usage
- High CPU usage
- Service downtime

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use secrets management** - Consider Google Secret Manager for production
3. **Rotate credentials** regularly
4. **Limit access** - Use RBAC to control who can access the cluster
5. **Use HTTPS** - Set up SSL/TLS for production (use Ingress with cert-manager)
6. **Monitor logs** - Set up log aggregation and monitoring

---

## Next Steps

- [ ] Set up HTTPS with Ingress and SSL certificate
- [ ] Configure horizontal pod autoscaling
- [ ] Set up monitoring and alerting
- [ ] Implement CI/CD pipeline for automated deployments
- [ ] Add resource quotas and limits
- [ ] Set up backup and disaster recovery

---

## Quick Reference

```bash
# Common commands
kubectl get pods                                    # List pods
kubectl logs -f -l app=notion-jira-automation      # Follow logs
kubectl describe pod <pod-name>                     # Pod details
kubectl exec -it <pod-name> -- /bin/sh             # Shell into pod
kubectl rollout restart deployment notion-jira-automation  # Restart
kubectl get service notion-jira-automation          # Get service IP
```

---

## Support

For issues or questions:
1. Check logs: `kubectl logs -l app=notion-jira-automation`
2. Review [README.md](../README.md) for application details
3. Check [WEBHOOK_SETUP.md](../WEBHOOK_SETUP.md) for webhook configuration
