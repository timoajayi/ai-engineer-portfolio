export type Project = {
  title: string;
  slug: string;
  category: string;
  description: string;
  technologies: string[];
  featured: boolean;
};

export const projects: Project[] = [
  {
    title: "Industrial AI Operations Copilot",
    slug: "industrial-ai-operations-copilot",
    category: "Industrial AI · Agentic AI",
    description:
      "An AI-assisted operations platform for investigating machine behavior, detecting anomalies, retrieving technical documentation, and explaining findings through tool-driven AI workflows.",
    technologies: [
      "Python",
      "Machine Learning",
      "RAG",
      "Agentic AI",
      "FastAPI",
    ],
    featured: true,
  },
  {
    title: "AI Portfolio Assistant",
    slug: "ai-portfolio-assistant",
    category: "LLMs · RAG",
    description:
      "A grounded AI assistant designed to answer questions about my projects, technical skills, experience, and engineering background.",
    technologies: ["Python", "LLMs", "RAG", "API"],
    featured: true,
  },
  {
    title: "BundesHost Tourism Forecasting",
    slug: "bundeshost-tourism-forecasting",
    category: "Machine Learning · MLOps",
    description:
      "An end-to-end tourism forecasting platform predicting overnight stays across Germany's 16 federal states using time-series models and production-oriented ML infrastructure.",
    technologies: [
      "Python",
      "SARIMA",
      "FastAPI",
      "Docker",
      "MLflow",
      "PostgreSQL",
    ],
    featured: true,
  },
  {
    title: "Customer Churn Prediction",
    slug: "customer-churn-prediction",
    category: "Machine Learning",
    description:
      "A customer churn prediction system comparing multiple machine-learning approaches while addressing class imbalance and business-relevant model evaluation.",
    technologies: [
      "Python",
      "Scikit-learn",
      "XGBoost",
      "LightGBM",
      "TensorFlow",
    ],
    featured: true,
  },
  {
    title: "AI Creative Studio",
    slug: "ai-creative-studio",
    category: "Generative AI",
    description:
      "A generative AI platform for creating and comparing marketing imagery through a FastAPI backend, Streamlit interface, and ComfyUI image-generation workflow.",
    technologies: ["Python", "FastAPI", "Streamlit", "ComfyUI"],
    featured: true,
  },
];