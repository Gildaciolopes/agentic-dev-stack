import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API, Next internals, static files and the agent-readable .md/.txt routes.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
