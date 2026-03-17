#!/bin/bash

# Minikube Deployment Script for Notion-Jira Automation
# This script deploys the application to local Minikube cluster

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy to Minikube${NC}"
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

# Check if Minikube is running
print_step "Checking Minikube status..."
if ! minikube status &> /dev/null; then
    print_error "Minikube is not running!"
    print_info "Please run: ./k8s/setup-minikube.sh"
    exit 1
fi
print_info "✓ Minikube is running"
echo ""

# Verify kubectl is configured for Minikube
print_step "Verifying kubectl context..."
CURRENT_CONTEXT=$(kubectl config current-context)
if [ "$CURRENT_CONTEXT" != "minikube" ]; then
    print_warning "kubectl is not using Minikube context"
    print_info "Switching to Minikube context..."
    kubectl config use-context minikube
fi
print_info "✓ kubectl is using Minikube context"
echo ""

# Configure Docker to use Minikube's daemon
print_step "Configuring Docker to use Minikube's daemon..."
eval $(minikube docker-env)
print_info "✓ Docker configured for Minikube"
echo ""

# Build Docker image
print_step "Building Docker image..."
docker build -t notion-jira-automation:latest .
print_info "✓ Docker image built successfully"
echo ""

# Verify image exists
print_step "Verifying Docker image..."
if docker images | grep -q "notion-jira-automation"; then
    print_info "✓ Image found in Minikube's Docker daemon"
    docker images | grep notion-jira-automation
else
    print_error "Image not found!"
    exit 1
fi
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
        
        # Check for .env file
        if [ -f ".env" ]; then
            print_info "Creating secret from .env file..."
            kubectl create secret generic notion-jira-secrets --from-env-file=.env
            print_info "✓ Secret created from .env"
        elif [ -f "secrets.env" ]; then
            print_info "Creating secret from secrets.env file..."
            kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env
            print_info "✓ Secret created from secrets.env"
        else
            print_error "No .env or secrets.env file found!"
            print_info "Please create one of these files with your credentials"
            exit 1
        fi
    fi
else
    print_info "Secret does not exist, creating..."
    
    # Check for .env file
    if [ -f ".env" ]; then
        print_info "Creating secret from .env file..."
        kubectl create secret generic notion-jira-secrets --from-env-file=.env
        print_info "✓ Secret created from .env"
    elif [ -f "secrets.env" ]; then
        print_info "Creating secret from secrets.env file..."
        kubectl create secret generic notion-jira-secrets --from-env-file=secrets.env
        print_info "✓ Secret created from secrets.env"
    else
        print_error "No .env or secrets.env file found!"
        print_info "Please create one of these files with your credentials"
        exit 1
    fi
fi
echo ""

# Apply deployment
print_step "Applying Kubernetes deployment..."
kubectl apply -f k8s/deployment-minikube.yaml
print_info "✓ Deployment applied"
echo ""

# Apply service
print_step "Applying Kubernetes service..."
kubectl apply -f k8s/service-minikube.yaml
print_info "✓ Service applied"
echo ""

# Wait for deployment
print_step "Waiting for deployment to be ready..."
kubectl rollout status deployment notion-jira-automation --timeout=3m
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

# Get service URL
print_step "Getting service URL..."
SERVICE_URL=$(minikube service notion-jira-automation --url)
print_info "✓ Service URL: ${SERVICE_URL}"
echo ""

# Test health endpoint
print_step "Testing health endpoint..."
sleep 5  # Give the service a moment to be ready
HEALTH_RESPONSE=$(curl -s ${SERVICE_URL}/webhook/health || echo "failed")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    print_info "✓ Health check passed"
    echo -e "${GREEN}${HEALTH_RESPONSE}${NC}"
else
    print_warning "Health check failed or service not ready yet"
    print_info "Response: ${HEALTH_RESPONSE}"
    print_info "Try again in a few seconds: curl ${SERVICE_URL}/webhook/health"
fi
echo ""

# Test connections
print_step "Testing Notion and Jira connections..."
sleep 2
CONN_RESPONSE=$(curl -s ${SERVICE_URL}/webhook/test || echo "failed")
if [[ $CONN_RESPONSE == *"notion"* ]]; then
    print_info "✓ Connection test completed"
    echo -e "${GREEN}${CONN_RESPONSE}${NC}"
else
    print_warning "Connection test failed or service not ready yet"
    print_info "Response: ${CONN_RESPONSE}"
fi
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Service URL:${NC} ${SERVICE_URL}"
echo -e "${BLUE}Webhook URL:${NC} ${SERVICE_URL}/webhook/notion"
echo -e "${BLUE}Health Check:${NC} ${SERVICE_URL}/webhook/health"
echo -e "${BLUE}Test Endpoint:${NC} ${SERVICE_URL}/webhook/test"
echo ""
echo -e "${YELLOW}Testing Commands:${NC}"
echo "  curl ${SERVICE_URL}/webhook/health"
echo "  curl ${SERVICE_URL}/webhook/test"
echo ""
echo -e "${YELLOW}For Notion webhook (requires tunneling):${NC}"
echo "  # Install localtunnel"
echo "  npm install -g localtunnel"
echo ""
echo "  # Create tunnel"
echo "  lt --port $(echo ${SERVICE_URL} | cut -d':' -f3) --subdomain ardit-jira-sync"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  kubectl logs -f -l app=notion-jira-automation  # Follow logs"
echo "  kubectl get pods                                # List pods"
echo "  kubectl describe pod <pod-name>                 # Pod details"
echo "  minikube dashboard                              # Open dashboard"
echo "  minikube service notion-jira-automation         # Open service in browser"
echo ""
echo -e "${BLUE}To access the service:${NC}"
echo "  minikube service notion-jira-automation"
echo ""
