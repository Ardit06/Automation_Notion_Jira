#!/bin/bash

# Notion-Jira Automation - Quick Deploy Script
# This script automates the deployment process to GKE

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="arhm-206818"
CLUSTER_NAME="arhm-cluster-2"
CLUSTER_REGION="us-east1"
IMAGE_REGISTRY="us-central1-docker.pkg.dev"
IMAGE_PATH="${IMAGE_REGISTRY}/${PROJECT_ID}/notion-jira/notion-jira-automation:latest"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Notion-Jira Automation Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

# Function to print info
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is installed
print_step "Checking prerequisites..."
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install it first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "docker is not installed. Please install it first."
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud is not installed. Please install it first."
    exit 1
fi

print_info "✓ kubectl found: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
print_info "✓ docker found: $(docker --version)"
print_info "✓ gcloud found: $(gcloud --version | head -n 1)"
echo ""

# Set GCP project
print_step "Setting GCP project..."
gcloud config set project ${PROJECT_ID}
print_info "✓ Project set to: ${PROJECT_ID}"
echo ""

# Connect to cluster
print_step "Connecting to GKE cluster..."
gcloud container clusters get-credentials ${CLUSTER_NAME} --region ${CLUSTER_REGION}
print_info "✓ Connected to cluster: ${CLUSTER_NAME}"
echo ""

# Verify cluster connection
print_step "Verifying cluster connection..."
kubectl cluster-info | head -n 1
kubectl get nodes
echo ""

# Build Docker image
print_step "Building Docker image..."
docker build -t notion-jira-automation:latest .
print_info "✓ Docker image built successfully"
echo ""

# Configure Docker for GCP
print_step "Configuring Docker for GCP Artifact Registry..."
gcloud auth configure-docker ${IMAGE_REGISTRY} --quiet
print_info "✓ Docker configured for GCP"
echo ""

# Tag and push image
print_step "Tagging and pushing Docker image..."
docker tag notion-jira-automation:latest ${IMAGE_PATH}
docker push ${IMAGE_PATH}
print_info "✓ Image pushed to: ${IMAGE_PATH}"
echo ""

# Check if secrets exist
print_step "Checking for secrets..."
if kubectl get secret notion-jira-secrets &> /dev/null; then
    print_warning "Secret 'notion-jira-secrets' already exists"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete secret notion-jira-secrets
        print_info "✓ Old secret deleted"
        
        if [ -f "secrets.env" ]; then
            kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env
            print_info "✓ New secret created from secrets.env"
        else
            print_error "secrets.env file not found!"
            print_info "Please create secrets.env file with your credentials"
            exit 1
        fi
    fi
else
    print_info "Secret does not exist, creating..."
    if [ -f "secrets.env" ]; then
        kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env
        print_info "✓ Secret created from secrets.env"
    else
        print_error "secrets.env file not found!"
        print_info "Please create secrets.env file with your credentials"
        exit 1
    fi
fi
echo ""

# Apply deployment
print_step "Applying Kubernetes deployment..."
kubectl apply -f k8s/deployment.yaml
print_info "✓ Deployment applied"
echo ""

# Apply service
print_step "Applying Kubernetes service..."
kubectl apply -f k8s/service.yaml
print_info "✓ Service applied"
echo ""

# Wait for deployment
print_step "Waiting for deployment to be ready..."
kubectl rollout status deployment notion-jira-automation --timeout=5m
print_info "✓ Deployment is ready"
echo ""

# Get pod status
print_step "Checking pod status..."
kubectl get pods -l app=notion-jira-automation
echo ""

# Get service info
print_step "Getting service information..."
kubectl get service notion-jira-automation
echo ""

# Wait for external IP
print_info "Waiting for external IP (this may take a few minutes)..."
EXTERNAL_IP=""
while [ -z $EXTERNAL_IP ]; do
    EXTERNAL_IP=$(kubectl get service notion-jira-automation -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ -z $EXTERNAL_IP ]; then
        print_info "Waiting for external IP..."
        sleep 10
    fi
done
print_info "✓ External IP assigned: ${EXTERNAL_IP}"
echo ""

# Test health endpoint
print_step "Testing health endpoint..."
sleep 10  # Give the service a moment to be ready
HEALTH_RESPONSE=$(curl -s http://${EXTERNAL_IP}/webhook/health || echo "failed")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    print_info "✓ Health check passed"
    echo -e "${GREEN}${HEALTH_RESPONSE}${NC}"
else
    print_warning "Health check failed or service not ready yet"
    print_info "Response: ${HEALTH_RESPONSE}"
fi
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Service URL:${NC} http://${EXTERNAL_IP}"
echo -e "${BLUE}Webhook URL:${NC} http://${EXTERNAL_IP}/webhook/notion"
echo -e "${BLUE}Health Check:${NC} http://${EXTERNAL_IP}/webhook/health"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure Notion webhook with URL: http://${EXTERNAL_IP}/webhook/notion"
echo "2. Monitor logs: kubectl logs -f -l app=notion-jira-automation"
echo "3. Check status: kubectl get pods -l app=notion-jira-automation"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  kubectl logs -f -l app=notion-jira-automation  # Follow logs"
echo "  kubectl get pods                                # List pods"
echo "  kubectl describe pod <pod-name>                 # Pod details"
echo "  kubectl rollout restart deployment notion-jira-automation  # Restart"
echo ""
