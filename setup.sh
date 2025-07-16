#!/bin/bash

# AI Search Booster v2 - Quick Setup Script
# This script helps you set up the development environment quickly

echo "🚀 AI Search Booster v2 - Setup Script"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Create directories if they don't exist
echo ""
echo "📁 Setting up project structure..."
mkdir -p server client

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd server
if [ ! -f "package.json" ]; then
    echo "❌ server/package.json not found. Please ensure you have the complete project files."
    exit 1
fi
npm install

# Copy environment file
if [ ! -f ".env" ]; then
    if [ -f "../.env.example" ]; then
        cp ../.env.example .env
        echo "📄 Created .env file - Please update with your API keys!"
    else
        echo "⚠️  No .env.example found. Please create .env manually."
    fi
fi

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd ../client
if [ ! -f "package.json" ]; then
    echo "❌ client/package.json not found. Please ensure you have the complete project files."
    exit 1
fi
npm install

# Check for Shopify CLI
echo ""
if command -v shopify &> /dev/null; then
    echo "✅ Shopify CLI detected"
else
    echo "⚠️  Shopify CLI not found. Install it for theme extension deployment:"
    echo "   npm install -g @shopify/cli @shopify/theme"
fi

# Create necessary directories
echo ""
echo "📁 Creating additional directories..."
cd ..
mkdir -p extensions logs uploads temp

# Display next steps
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Update server/.env with your API keys:"
echo "   - SHOPIFY_API_SECRET"
echo "   - ANTHROPIC_API_KEY or OPENAI_API_KEY"
echo "   - SHOPIFY_WEBHOOK_SECRET"
echo ""
echo "2. Start the development servers:"
echo "   Backend: cd server && npm start"
echo "   Frontend: cd client && npm run dev"
echo ""
echo "3. Configure your Shopify app:"
echo "   - Set OAuth redirect URLs"
echo "   - Enable required scopes"
echo "   - Set up webhooks"
echo ""
echo "4. Deploy to production:"
echo "   - Push to GitHub"
echo "   - Deploy backend to Render"
echo "   - Deploy frontend to Render"
echo "   - Install theme extension"
echo ""
echo "📚 Full documentation: README.md"
echo "🆘 Need help? Check TROUBLESHOOTING.md"
echo ""
echo "Happy optimizing! 🎉"