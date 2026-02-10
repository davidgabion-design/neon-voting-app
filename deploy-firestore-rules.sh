#!/bin/bash
# Deploy Firestore Rules Script

echo "Deploying Firestore Security Rules..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI is not installed!"
    echo "Please install it using: npm install -g firebase-tools"
    exit 1
fi

echo "Firebase CLI version: $(firebase --version)"

# Check if logged in
echo "Checking Firebase authentication..."
firebase login:list

# Deploy only Firestore rules
echo -e "\nDeploying Firestore rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo -e "\nFirestore rules deployed successfully!"
else
    echo -e "\nFailed to deploy Firestore rules!"
    exit 1
fi

echo -e "\nDone!"
