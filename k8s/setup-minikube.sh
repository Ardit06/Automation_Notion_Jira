#!/bin/bash

# Minikube Setup Script for Notion-Jira Automation
# This script installs Minikube and sets up the local Kubernetes environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Minikube Setup for Local Testing${NC}"
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

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

print_info "Detected OS: ${MACHINE}"
echo ""

# Check if Minikube is already installed
print_step "Checking if Minikube is installed..."
if command -v minikube &> /dev/null; then
    print_info "✓ Minikube is already installed: $(minikube version --short)"
    MINIKUBE_INSTALLED=true
else
    print_warning "Minikube is not installed"
    MINIKUBE_INSTALLED=false
fi
echo ""

# Install Minikube if not installed
if [ "$MINIKUBE_INSTALLED" = false ]; then
    print_step "Installing Minikube..."
    
    if [ "$MACHINE" = "Mac" ]; then
        # Check if Homebrew is installed
        if command -v brew &> /dev/null; then
            print_info "Installing Minikube via Homebrew..."
            brew install minikube
        else
            print_info "Installing Minikube manually..."
            curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-darwin-amd64
            sudo install minikube-darwin-amd64 /usr/local/bin/minikube
            rm minikube-darwin-amd64
        fi
    elif [ "$MACHINE" = "Linux" ]; then
        print_info "Installing Minikube for Linux..."
        curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
        sudo install minikube-linux-amd64 /usr/local/bin/minikube
        rm minikube-linux-amd64
    else
        print_error "Unsupported operating system: ${MACHINE}"
        exit 1
    fi
    
    print_info "✓ Minikube installed successfully"
fi
echo ""

# Check if kubectl is installed
print_step "Checking if kubectl is installed..."
if ! command -v kubectl &> /dev/null; then
    print_warning "kubectl is not installed, installing..."
    
    if [ "$MACHINE" = "Mac" ]; then
        if command -v brew &> /dev/null; then
            brew install kubectl
        else
            curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
            chmod +x kubectl
            sudo mv kubectl /usr/local/bin/
        fi
    elif [ "$MACHINE" = "Linux" ]; then
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    fi
    
    print_info "✓ kubectl installed successfully"
else
    print_info "✓ kubectl is already installed: $(kubectl version --client --short 2>/dev/null || echo 'installed')"
fi
echo ""

# Check if Docker is installed
print_step "Checking if Docker is installed..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed!"
    print_info "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
else
    print_info "✓ Docker is installed: $(docker --version)"
fi
echo ""

# Check if Minikube is running
print_step "Checking Minikube status..."
if minikube status &> /dev/null; then
    print_info "✓ Minikube is already running"
    MINIKUBE_RUNNING=true
else
    print_warning "Minikube is not running"
    MINIKUBE_RUNNING=false
fi
echo ""

# Start Minikube if not running
if [ "$MINIKUBE_RUNNING" = false ]; then
    print_step "Starting Minikube..."
    print_info "This may take a few minutes on first run..."
    
    # Start with Docker driver and allocate resources
    minikube start --driver=docker --cpus=2 --memory=4096
    
    print_info "✓ Minikube started successfully"
else
    print_info "Using existing Minikube cluster"
fi
echo ""

# Verify Minikube is running
print_step "Verifying Minikube cluster..."
minikube status
echo ""

# Configure kubectl to use Minikube
print_step "Configuring kubectl for Minikube..."
kubectl config use-context minikube
print_info "✓ kubectl configured to use Minikube"
echo ""

# Verify cluster connection
print_step "Verifying cluster connection..."
kubectl cluster-info
echo ""
kubectl get nodes
echo ""

# Enable Minikube addons
print_step "Enabling useful Minikube addons..."
minikube addons enable metrics-server
minikube addons enable dashboard
print_info "✓ Addons enabled"
echo ""

# Configure Docker to use Minikube's Docker daemon
print_step "Configuring Docker environment..."
print_info "To use Minikube's Docker daemon, run:"
echo -e "${YELLOW}eval \$(minikube docker-env)${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Minikube Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Minikube Status:${NC}"
minikube status
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Configure Docker to use Minikube's daemon:"
echo -e "   ${YELLOW}eval \$(minikube docker-env)${NC}"
echo ""
echo "2. Build your Docker image:"
echo -e "   ${YELLOW}docker build -t notion-jira-automation:latest .${NC}"
echo ""
echo "3. Deploy to Minikube:"
echo -e "   ${YELLOW}./k8s/deploy-minikube.sh${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  minikube status              # Check Minikube status"
echo "  minikube dashboard           # Open Kubernetes dashboard"
echo "  minikube stop                # Stop Minikube"
echo "  minikube delete              # Delete Minikube cluster"
echo "  kubectl get pods             # List pods"
echo "  kubectl get services         # List services"
echo ""
