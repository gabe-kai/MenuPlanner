import { proxy } from "./src/proxy";

export default proxy;

export const config = {
  matcher: [
    "/school-lunch/:path*",
    "/account",
    "/admin/:path*",
    "/planner",
    "/recipes",
    "/recipes/:path*",
  ],
};
