import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@/styles/index.css";

import ErrorBoundary from "@/shared/components/ErrorBoundary";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/shared/context/ToastContext";
import { ConfirmProvider } from "@/shared/context/ConfirmContext";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* Inside the router (it re-mounts on navigation) but outside the
          providers, so a throw from AuthProvider is caught too. */}
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
