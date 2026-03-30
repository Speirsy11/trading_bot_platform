import { Fragment } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./app.css";
import { installDeterministicLocaleFormatters } from "./shared/format";
import { theme1 } from "./theme-1";
import { theme2 } from "./theme-2";
import { theme3 } from "./theme-3";
import { theme4 } from "./theme-4";
import { theme5 } from "./theme-5";

const routeThemes = [theme1, theme2, theme3, theme4, theme5];

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/theme-1/homepage" replace />} />
        {routeThemes.map((theme) => (
          <Fragment key={theme.id}>
            <Route path={`/${theme.id}/homepage`} element={<theme.Homepage />} />
            <Route path={`/${theme.id}/dashboard`} element={<theme.Dashboard />} />
            <Route path={`/${theme.id}/trading`} element={<theme.Trading />} />
            <Route path={`/${theme.id}/bots`} element={<theme.Bots />} />
          </Fragment>
        ))}
        <Route path="*" element={<Navigate to="/theme-1/homepage" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Wireframes root element not found.");
}

installDeterministicLocaleFormatters();

ReactDOM.createRoot(rootElement).render(<AppRouter />);
