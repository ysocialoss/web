import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LazyMotion } from "motion/react"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LazyMotion>
  </StrictMode>
)
