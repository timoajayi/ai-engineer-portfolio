# AI Engineer Portfolio

A modern AI Engineer portfolio built with **Next.js, React, TypeScript, and Tailwind CSS**, designed to present my machine learning, LLM, agentic AI, and MLOps work through structured technical case studies.

The portfolio also includes an integrated **AI Portfolio Assistant** that allows recruiters, hiring managers, and technical visitors to ask questions about my projects, skills, experience, and current work.

---

## Overview

This portfolio was built as more than a static personal website.

The goal is to provide a clear technical view of my work as an AI Engineer, including:

- machine learning projects
- LLM and RAG applications
- agentic AI systems
- backend and API development
- MLOps and deployment workflows
- technical case studies
- professional experience and engineering background

Projects are stored as structured data and rendered through reusable components and dynamic Next.js routes.

The portfolio also connects to a separate FastAPI-based RAG backend that powers the conversational AI assistant.

---

## Key Features

- Responsive AI Engineer portfolio
- Dark-first technical interface
- Reusable React components
- Data-driven project system
- Dynamic project case-study routes
- Individual and team project distinction
- Completed and in-progress project states
- Technical architecture visualizations
- Integrated AI Portfolio Assistant
- Markdown rendering for assistant responses
- Environment-based backend configuration
- TypeScript type safety
- ESLint validation
- Production build support

---

## Architecture

```text
                        AI Engineer Portfolio
                                |
                                v
                      Next.js / React Frontend
                                |
              +-----------------+------------------+
              |                                    |
              v                                    v
       Portfolio Content                    AI Portfolio Assistant
              |                                    |
              v                                    |
       Structured Project Data                     |
              |                                    |
              v                                    |
      Dynamic Case Studies                         |
                                                   |
                                                   | POST /chat
                                                   v
                                          FastAPI RAG Backend
                                                   |
                                                   v
                                         Hybrid Retrieval
                                                   |
                                                   v
                                             Google Gemini
                                                   |
                                                   v
                                         Grounded Response
```

The portfolio frontend and AI assistant backend are maintained as separate applications.

This separation allows the Next.js application to focus on presentation and user experience while the Python backend handles retrieval, embeddings, routing, and language-model interaction.

---

## Portfolio Structure

The homepage is composed from reusable sections:

```text
Navbar
   |
   v
Hero
   |
   v
Featured Projects
   |
   v
About
   |
   v
Technical Skills
   |
   v
AI Portfolio Assistant
   |
   v
Experience / Journey
   |
   v
Contact
```

Each section is implemented as an independent React component.

---

## Project Case Studies

Project information is stored centrally in:

```text
src/data/projects.ts
```

Each project contains structured information such as:

- title
- slug
- category
- project type
- description
- technologies
- development status
- problem
- solution
- architecture
- contributions
- results
- GitHub or demo links

The project cards on the homepage and the detailed case-study pages use the same data source.

This avoids duplicating project information across the website.

---

## Dynamic Routing

Detailed project pages are generated through the dynamic Next.js route:

```text
src/app/projects/[slug]/page.tsx
```

For example:

```text
/projects/bundeshost-tourism-forecasting
/projects/customer-churn-prediction
/projects/ai-project-status-agent
```

The route reads the requested slug, finds the corresponding project in the central project dataset, and renders the appropriate case study.

This allows new projects to be added primarily by extending the project data rather than creating a completely separate page for every project.

---

## Individual vs Team Projects

The project model distinguishes between:

```text
solo
team
```

This allows case studies to communicate ownership accurately.

For individual projects, the case study presents:

```text
What I Built
```

For team projects, it presents:

```text
My Contribution
```

This distinction is intentional so that collaborative work is not presented as individual ownership.

---

## Current Projects

The portfolio currently presents work across machine learning, MLOps, RAG, agentic AI, and generative AI.

### BundesHost Tourism Forecasting

A team-based tourism forecasting system covering Germany's 16 federal states.

The project combines time-series forecasting with an engineering stack including FastAPI, PostgreSQL, dbt, MLflow, Prefect, Docker, and Streamlit.

### Customer Churn Prediction

An end-to-end machine-learning project focused on identifying customers at risk of churn.

The project explores multiple classification models, class imbalance strategies, threshold tuning, evaluation metrics, and an interactive Streamlit application.

### AI Project Status Agent

A tool-using AI agent that answers project-management questions from structured project data.

The system uses LangChain, Google Gemini, Python tools, tool calling, and Streamlit.

### AI Creative Studio

A generative AI application for creating marketing-oriented visual content through an application interface and generative image workflow.

### AI Portfolio Assistant

A RAG-based conversational assistant integrated directly into this portfolio.

It uses a separate FastAPI backend with hybrid semantic and BM25 retrieval, query expansion, query routing, Gemini embeddings, and grounded response generation.

### Industrial AI Operations Copilot

An in-development Industrial AI concept focused on combining machine learning, RAG, and tool-driven AI workflows to investigate abnormal machine behavior and retrieve relevant technical guidance.

---

## AI Portfolio Assistant

The portfolio includes a conversational interface implemented in:

```text
src/components/FloatingPortfolioAssistant.tsx
```

Visitors can ask questions such as:

```text
What AI projects has Timothy built?

What experience does Timothy have with MLOps?

Has Timothy worked with RAG and agentic AI?
```

The frontend sends the question to the separate AI Portfolio Assistant API.

```text
Visitor
   |
   v
FloatingPortfolioAssistant.tsx
   |
   | POST /chat
   v
FastAPI Backend
   |
   v
RAG Pipeline
   |
   v
Grounded Answer
   |
   v
Portfolio UI
```

The backend is intentionally kept separate from the Next.js application so that AI retrieval and generation logic remains isolated from frontend presentation.

---

## AI Assistant Backend

The RAG backend is maintained in a separate repository:

**AI Portfolio Assistant**

https://github.com/timoajayi/ai-portfolio-assistant

The backend provides:

- FastAPI REST API
- portfolio knowledge base
- Gemini embeddings
- semantic retrieval
- BM25 lexical retrieval
- hybrid ranking
- deterministic query expansion
- project-collection query routing
- grounded Gemini generation
- retrieval evaluation
- query-router evaluation

---

## Project Structure

```text
ai-engineer-portfolio/
|
├── public/
|
├── src/
│   ├── app/
│   │   ├── projects/
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── About.tsx
│   │   ├── ArchitectureDiagram.tsx
│   │   ├── Contact.tsx
│   │   ├── Experience.tsx
│   │   ├── FeaturedProjects.tsx
│   │   ├── Hero.tsx
│   │   ├── Navbar.tsx
│   │   ├── FloatingPortfolioAssistant.tsx
│   │   ├── ProjectCard.tsx
│   │   └── Skills.tsx
│   │
│   └── data/
│       └── projects.ts
│
├── eslint.config.mjs
├── next.config.mjs
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

### AI Assistant Integration

- REST API
- FastAPI backend
- React Markdown
- Retrieval-Augmented Generation
- Google Gemini

### Development

- Node.js
- npm
- ESLint
- Git
- GitHub

### Deployment

The application is structured for deployment with:

- Vercel for the Next.js frontend
- a separately hosted FastAPI backend

Deployment is currently pending.

---

## Local Development

### 1. Clone the repository

```bash
git clone git@github.com:timoajayi/ai-engineer-portfolio.git
cd ai-engineer-portfolio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the AI assistant API

Create:

```text
.env.local
```

Add:

```env
NEXT_PUBLIC_AI_ASSISTANT_API_URL=http://127.0.0.1:8000
```

The AI assistant backend must be running separately for the conversational interface to work.

No Gemini or other private API keys should be stored in this frontend repository.

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Development Checks

### ESLint

```bash
npm run lint
```

### TypeScript

```bash
npx tsc --noEmit
```

### Production Build

```bash
npm run build
```

These checks are used before production deployment to verify linting, type safety, and successful Next.js compilation.

---

## Environment Variables

The frontend requires:

```env
NEXT_PUBLIC_AI_ASSISTANT_API_URL=
```

Because this variable is intentionally available to browser-side code, it contains only the public URL of the backend API.

Private credentials such as the Google Gemini API key remain exclusively in the backend application.

---

## Current Status

The portfolio application is functional locally.

Completed:

- portfolio design and layout
- responsive component structure
- homepage sections
- project data model
- reusable project cards
- dynamic project case-study routes
- architecture visualization component
- AI assistant chat interface
- suggested assistant questions
- conversational message rendering
- loading and error states
- Markdown assistant responses
- environment-based API configuration
- FastAPI backend integration
- ESLint validation
- TypeScript validation
- production build validation

Remaining before public release:

- final content and link review
- contact information
- CV integration
- final responsive testing
- production backend configuration
- frontend deployment
- backend deployment

---

## Related Repository

### AI Portfolio Assistant

The Python RAG backend powering the portfolio assistant:

https://github.com/timoajayi/ai-portfolio-assistant

---

## Author

**Timothy Ajayi**

AI Engineer focused on machine learning, LLM applications, RAG, agentic AI, backend systems, and MLOps.

Based in Germany.