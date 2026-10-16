import { createRoot } from "react-dom/client";

import { ColorThemeProvider } from "./contexts/ColorThemeContext.tsx";
import { UserProvider } from "./contexts/UserContext.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import "./index.css";
import App from "./App.tsx";
import { JokesProvider } from "./contexts/JokesContext.tsx";
import { LanguageProvider } from "./contexts/LanguageContext.tsx";
import { ToastContainer } from "react-toastify";
import { ModerationProvider } from "./contexts/ModerationContext.tsx";
import { registerServiceWorker } from "./registerServiceWorker.ts";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <ColorThemeProvider>
    <AuthProvider>
      <UserProvider>
        <LanguageProvider>
          <JokesProvider>
            <ModerationProvider>
              <App />
              <ToastContainer
                position="bottom-center"
                autoClose={3500}
                newestOnTop
                closeOnClick
                pauseOnHover
                draggable
                theme="colored"
              />
            </ModerationProvider>
          </JokesProvider>
        </LanguageProvider>
      </UserProvider>
    </AuthProvider>
  </ColorThemeProvider>,
  // </StrictMode>
);
