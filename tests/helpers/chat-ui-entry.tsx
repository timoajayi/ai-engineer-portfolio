// Browser test entry only; never imported by application routes or components.
import { createRoot } from "react-dom/client";
import FloatingPortfolioAssistant from "../../src/components/FloatingPortfolioAssistant";

createRoot(document.getElementById("app")!).render(
  <FloatingPortfolioAssistant verificationSiteKey="offline-public-site-key" />,
);
