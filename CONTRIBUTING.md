# Contributing to WhatsApp Conversation Summarizer

Thank you for your interest in contributing! Here's how you can help:

There is a known buglist, ask for the details.

## 🛠 Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Environment Setup:**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp apps/api/.env.example apps/api/.env
   ```
6. Make your changes
7. Run the development server:
   ```bash
   pnpm dev
   ```
8. Test your changes:
   ```bash
   pnpm test
   pnpm lint
   ```
9. Commit your changes with a descriptive message
10. Push to your fork and open a Pull Request

### Azure Infrastructure Setup (Optional)

If you need to work with Azure infrastructure or GitHub Actions workflows:

- **Azure Credentials Configuration**: See [Azure Setup Guide](docs/AZURE_SETUP.md) for detailed instructions on configuring OIDC authentication for GitHub Actions.
- **Infrastructure Deployment**: See [Infrastructure Guide](infra/README.md) for deploying Azure resources.

## 📝 Code Style

- Follow the project's existing code style
- Use TypeScript types where applicable
- Write meaningful commit messages
- Keep PRs focused on a single feature or fix

## 🐛 Reporting Issues

When reporting bugs, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS version
- Any error messages

## 🚀 Feature Requests

For new features, please:
1. Check if a similar feature request exists
2. Describe the feature and why it would be valuable
3. Include any relevant examples or mockups

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
