import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupApiAuth } from "./lib/api";

setupApiAuth();

createRoot(document.getElementById("root")!).render(<App />);
