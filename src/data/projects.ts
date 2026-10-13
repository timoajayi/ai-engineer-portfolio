export type Project = {
  title: string;
  slug: string;
  category: string;
  description: string;
  technologies: string[];
  featured: boolean;
  status: "completed" | "in-progress";
  problem: string;
  solution: string;

  architecture?: string;
  contributions?: string[];
  results?: {
    label: string;
    value: string;
  }[];
  githubUrl?: string;
  demoUrl?: string;
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
        status: "in-progress",
        problem:
            "Industrial engineers often need to investigate machine alerts by manually combining sensor data, historical behavior, maintenance records, and technical documentation across different systems.",
        solution:
            "The planned solution is an Industrial AI Operations Copilot that will combine machine learning, retrieval-augmented generation, and tool-driven AI workflows to help engineers investigate abnormal machine behavior and retrieve relevant technical guidance.",
    },

    {
        title: "AI Portfolio Assistant",
        slug: "ai-portfolio-assistant",
        category: "LLMs · RAG",
        description:
            "A grounded AI assistant designed to answer questions about my projects, technical skills, experience, and engineering background.",
        technologies: [
            "Python",
            "LLMs",
            "RAG",
            "API",
        ],
        featured: true,
        status: "in-progress",
        problem:
            "A traditional portfolio requires recruiters and visitors to manually browse multiple sections to understand a candidate's projects, technical skills, experience, and engineering background.",
        solution:
            "The AI Portfolio Assistant provides a conversational interface that allows visitors to ask questions about my work and receive answers grounded in portfolio-specific information rather than relying only on general LLM knowledge.",
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
            "Prefect",
            "dbt",
            "Streamlit",
  ],
        featured: true,
        status: "completed",

        problem:
            "Tourism demand varies significantly across Germany's federal states, making it difficult to plan effectively using historical figures alone. The project required state-level forecasts while also providing a reliable way to store, serve, and explore the resulting predictions.",
        solution:
            "Built an end-to-end forecasting system using state-specific SARIMA models to generate 12-month forecasts for all 16 German federal states. The system combined PostgreSQL and dbt for data workflows, MLflow for experiment tracking, Prefect for orchestration, FastAPI for serving forecasts, and a Streamlit interface consuming the API.",
        architecture:
            "Historical tourism data flows through the data pipeline into PostgreSQL, where dbt supports data transformation. State-specific forecasting models generate predictions, MLflow tracks model experiments, and Prefect supports workflow orchestration. Forecast results are exposed through a FastAPI backend and consumed by the Streamlit frontend.",

        contributions: [
             "Developed FastAPI endpoints for serving tourism forecasts, historical data, and state-level information.",
            "Integrated the Streamlit frontend with the FastAPI backend so the interface consumed forecasting data through the API.",
            "Set up MLflow for experiment tracking and model development workflows.",
            "Worked with Docker to containerize and connect components of the application.",
            "Contributed to integrating the forecasting pipeline into an end-to-end application.",
  ],

        results: [
    {
        label: "Forecast horizon",
        value: "12 months",
    },
    {
        label: "Federal states",
        value: "16",
    },
    {
        label: "States below 10% error",
        value: "15 / 16",
    },
  ],
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
            "SMOTE",
            "Streamlit",
        ],
        featured: true,
        status: "completed",
        problem:
            "Customer churn creates a retention challenge because businesses need to identify customers who are likely to leave before the churn occurs. The dataset was also imbalanced, with churners representing only about 20% of customers, making accuracy alone an insufficient evaluation metric.",
        solution:
            "Built and compared multiple machine-learning models for churn prediction, including logistic regression, tree-based models, gradient boosting, XGBoost, LightGBM, and a neural network. The project addressed class imbalance using techniques such as SMOTE and class weighting, evaluated models with recall, F1 score, and ROC-AUC, and exposed predictions through a Streamlit application.",
    },

    {
        title: "AI Creative Studio",
        slug: "ai-creative-studio",
        category: "Generative AI",
        description:
            "A generative AI platform for creating and comparing marketing imagery through a FastAPI backend, Streamlit interface, and ComfyUI image-generation workflow.",
        technologies: [
            "Python",
            "FastAPI",
            "Streamlit",
            "ComfyUI",
            "Stable Diffusion",
            "Docker",
        ],
        featured: true,
        status: "completed",
        problem:
            "Generative image tools can produce strong visual results, but turning image generation into a repeatable workflow for marketing teams requires control over prompts, generation parameters, outputs, and comparison between generated assets.",
        solution:
            "Built an AI image-generation platform that connects a Streamlit interface to a FastAPI backend and ComfyUI workflow. Users can configure generation parameters, create multiple images, compare outputs, and review generation history through a single application.",
    },
];