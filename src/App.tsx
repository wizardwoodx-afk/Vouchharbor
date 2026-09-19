/**
 * VOUCH HARBOR 19.6.6 — THE APP IS ONE CONSOLE.
 *
 * The 19.6.6 redesign deleted the multi-dock shell outright: no sidebar of
 * six docks, no helm strip, no atelier chrome around the engine. The
 * Generalist's console IS the product — the crew, the run stream, the
 * handoff ledger and the federation plane all live inside it, and every
 * bubble carries the evidence of what actually happened.
 */
import React from "react";
import { NextConsole } from "./views/NextConsole";

/**
 * Retired by the 19.6.6 redesign — the console is the only surface. Kept as
 * a type export because the unmounted legacy dock views still compile
 * against it; nothing in the running app consumes it.
 */
export type ViewKey = "vh19" | "harbor" | "ship" | "chart" | "register" | "master" | "settings";

export const VouchApp: React.FC = () => <NextConsole />;

export default VouchApp;
