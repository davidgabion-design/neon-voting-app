# Deploy Firestore Rules Script

Write-Host "Deploying Firestore Security Rules..." -ForegroundColor Cyan

# Check if Firebase CLI is installed
try {
    $firebaseVersion = firebase --version
    Write-Host "Firebase CLI version: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Firebase CLI is not installed!" -ForegroundColor Red
    Write-Host "Please install it using: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
Write-Host "Checking Firebase authentication..." -ForegroundColor Cyan
firebase login:list

# Deploy only Firestore rules
Write-Host "`nDeploying Firestore rules..." -ForegroundColor Cyan
firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nFirestore rules deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nFailed to deploy Firestore rules!" -ForegroundColor Red
    exit 1
}

Write-Host "`nDone!" -ForegroundColor Green
