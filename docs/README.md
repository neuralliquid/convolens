# ConvoLens Documentation Index

Welcome to the **ConvoLens** documentation. This directory contains comprehensive guides, technical specifications, and strategic planning documents for our conversation analysis platform.

---

## 🚀 Quick Start

- **New to the project?** Start with [Architecture Overview](architecture.md)
- **Setting up Azure?** See [Azure Setup Guide](AZURE_SETUP.md)
- **Want to contribute?** Read [Implementation Plan](IMPLEMENTATION_PLAN.md)

---

## 📖 Core Documentation

### Architecture & Design

- **[Architecture Overview](architecture.md)** - System architecture and component design
- **[Phase 1 Tech Stack](PHASE_1_TECH_STACK.md)** - Technology choices and rationale
- **[Authentication](AUTHENTICATION.md)** - Auth implementation and security

### Planning & Strategy

- **[Implementation Plan](IMPLEMENTATION_PLAN.md)** - Roadmap for upcoming features and refactors
- **[Roadmap](ROADMAP.md)** - Long-term product vision and milestones
- **[Technical Debt Registry](TECHNICAL_DEBT.md)** - Known issues and tracking
- **[Future Considerations](FUTURE_CONSIDERATIONS.md)** - Ideas for future development

### Operations & Deployment

- **[Azure Setup Guide](AZURE_SETUP.md)** - Configure Azure credentials for GitHub Actions
- **[Runbook](runbook.md)** - Operational procedures and troubleshooting
- **[Observability](OBSERVABILITY.md)** - Monitoring, logging, and alerting

### Quality & Testing

- **[Testing Strategy](TESTING_STRATEGY.md)** - Testing approach and guidelines
- **[Code Review Analysis](CODE_REVIEW_ANALYSIS.md)** - Deep dive into codebase state

### User Documentation

- **[User Guide](USER_GUIDE.md)** - End-user documentation and tutorials

---

## 🎯 ConvoLens Branding

### 📌 Brand Resources

- **[Brand Color Guidelines](BRAND_COLOR_GUIDELINES.md)** 🎨 - When to use ConvoLens colors vs WhatsApp colors

### Brand Identity

**Product Name:** ConvoLens

The ConvoLens brand provides:

- **Complete Brand Identity** - Colors, logo concepts, voice guidelines
- **Color System** - ConvoLens brand colors + WhatsApp integration colors
- **Implementation Roadmap** - 5-phase plan over 12 weeks
- **Budget Guidance** - Three tiers from $3k to $100k+
- **Tagline:** "See Your Conversations Clearly"
- **Colors:** Deep Purple (#6B46C1) + Bright Cyan (#06B6D4) + Soft Lavender (#C4B5FD)
- **WhatsApp Colors:** Preserved for WhatsApp-specific features only
- **Philosophy:** Focus, clarity, and insight through data visualization
- **Platform Strategy:** Multi-platform (WhatsApp, Telegram, Discord, etc.)

---

## 🗂️ Specialized Documentation

### API Documentation

- **[API Documentation](api/)** - API endpoints and integration guides

### Architecture Decision Records (ADRs)

- **[ADR Directory](adr/)** - Architecture decisions and their context

### Document Templates

- **[Templates](docTemplates/)** - Standardized templates for various document types

### LLM Context

- **[LLMs Context](llms.txt)** - Project context optimized for Large Language Models

---

## 📚 Documentation by Topic

### Getting Started

| Document                        | Description                            |
| ------------------------------- | -------------------------------------- |
| [Architecture](architecture.md) | Start here to understand system design |
| [Azure Setup](AZURE_SETUP.md)   | Configure deployment infrastructure    |
| [User Guide](USER_GUIDE.md)     | Learn how to use the platform          |

### Development

| Document                                      | Description                    |
| --------------------------------------------- | ------------------------------ |
| [Implementation Plan](IMPLEMENTATION_PLAN.md) | Current development priorities |
| [Tech Stack](PHASE_1_TECH_STACK.md)           | Technology choices explained   |
| [Testing Strategy](TESTING_STRATEGY.md)       | How to test your code          |
| [Technical Debt](TECHNICAL_DEBT.md)           | Known issues to address        |

### Operations

| Document                          | Description                |
| --------------------------------- | -------------------------- |
| [Runbook](runbook.md)             | Operational procedures     |
| [Observability](OBSERVABILITY.md) | Monitoring and alerting    |
| [Azure Setup](AZURE_SETUP.md)     | Cloud infrastructure setup |

### Strategy & Planning

| Document                                              | Description                      |
| ----------------------------------------------------- | -------------------------------- |
| [Roadmap](ROADMAP.md)                                 | Long-term product vision         |
| [Future Considerations](FUTURE_CONSIDERATIONS.md)     | Ideas for exploration            |
| [Code Review Analysis](CODE_REVIEW_ANALYSIS.md)       | Codebase health assessment       |

---

## 🔍 Find Documentation By Need

### "I want to..."

- **Understand the architecture** → [Architecture Overview](architecture.md)
- **Deploy to Azure** → [Azure Setup Guide](AZURE_SETUP.md)
- **Add a new feature** → [Implementation Plan](IMPLEMENTATION_PLAN.md)
- **Fix a bug** → [Technical Debt Registry](TECHNICAL_DEBT.md)
- **Write tests** → [Testing Strategy](TESTING_STRATEGY.md)
- **Use the platform** → [User Guide](USER_GUIDE.md)
- **Monitor production** → [Observability](OBSERVABILITY.md) + [Runbook](runbook.md)
- **Understand tech choices** → [Phase 1 Tech Stack](PHASE_1_TECH_STACK.md)
- **See the roadmap** → [Roadmap](ROADMAP.md)

---

## 📝 Documentation Standards

### Writing Guidelines

- Use clear, concise language
- Include code examples where applicable
- Keep documents up to date with code changes
- Use markdown formatting consistently
- Include table of contents for long documents

### Document Structure

```markdown
# Document Title

Brief description of document purpose.

## Section 1

Content...

## Section 2

Content...

## References

Links to related documents
```

### Naming Conventions

- Use UPPER_SNAKE_CASE for acronyms (e.g., `API`, `ADR`)
- Use Title Case for document titles
- Use descriptive names that indicate content
- Keep filenames under 50 characters

---

## 🤝 Contributing to Documentation

### How to Update Documentation

1. **Edit existing docs**: Update inline as code changes
2. **Add new docs**: Follow templates in `docTemplates/`
3. **Update this index**: Add links when creating new docs
4. **Review changes**: Ensure markdown renders correctly

### When to Create New Documentation

- Major architectural changes
- New features or components
- Complex operational procedures
- Strategic decisions (ADRs)
- User-facing functionality

### Documentation Checklist

- [ ] Document has clear purpose
- [ ] Content is technically accurate
- [ ] Examples are tested and working
- [ ] Links to related docs included
- [ ] Added to this index
- [ ] Markdown formatting validated
- [ ] Spelling and grammar checked

---

## 🔗 External Resources

### Official Project Links

- **Repository**: [github.com/neuralliquid/convolens](https://github.com/neuralliquid/convolens)
- **Main README**: [README.md](../README.md)
- **Contributing Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Code of Conduct**: [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- **License**: [LICENSE](../LICENSE)

### Technology Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [pnpm Documentation](https://pnpm.io/)
- [Turbo Documentation](https://turbo.build/repo/docs)

---

## 📞 Support & Contact

### Getting Help

1. **Check documentation** - Most questions are answered here
2. **Search issues** - Someone may have asked before
3. **Ask the team** - Create a discussion or issue
4. **Review code** - Sometimes the code is the best documentation

### Reporting Documentation Issues

Found an error or unclear section?

1. Open an issue with label `documentation`
2. Describe the problem clearly
3. Suggest improvements if possible
4. Link to the problematic section

---

## 🗺️ Documentation Roadmap

### Planned Improvements

- [ ] Add interactive architecture diagrams
- [ ] Create video walkthroughs for setup
- [ ] Expand API documentation with examples
- [ ] Add troubleshooting guide
- [ ] Create deployment checklist
- [ ] Document common patterns and best practices
- [ ] Add performance optimization guide
- [ ] Create security hardening checklist

### Recently Added

- ✅ Azure setup guide with OIDC
- ✅ Testing strategy documentation
- ✅ Observability guidelines

---

## 📊 Documentation Metrics

| Metric          | Status                 |
| --------------- | ---------------------- |
| Total Documents | 20+                    |
| Last Updated    | December 2025          |
| Coverage        | ~85% of major features |
| Maintenance     | Active                 |

---

## 🎓 Learning Path

### For New Contributors

1. Start: [Architecture Overview](architecture.md)
2. Setup: [Azure Setup Guide](AZURE_SETUP.md)
3. Code: [Implementation Plan](IMPLEMENTATION_PLAN.md)
4. Test: [Testing Strategy](TESTING_STRATEGY.md)
5. Deploy: [Runbook](runbook.md)

### For Product Managers

1. Vision: [Roadmap](ROADMAP.md)
2. Current State: [Code Review Analysis](CODE_REVIEW_ANALYSIS.md)
3. Planning: [Implementation Plan](IMPLEMENTATION_PLAN.md)
4. Users: [User Guide](USER_GUIDE.md)

### For DevOps Engineers

1. Infrastructure: [Azure Setup Guide](AZURE_SETUP.md)
2. Operations: [Runbook](runbook.md)
3. Monitoring: [Observability](OBSERVABILITY.md)
4. Architecture: [Architecture Overview](architecture.md)

---

_This documentation index is maintained by the ConvoLens team. For questions or suggestions, please open an issue._

**Last Updated:** December 2025  
**Maintained By:** Core Team  
**Status:** Active Development
