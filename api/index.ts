/**
 * Vercel serverless entry for the Pacemaker API.
 *
 * Vercel routes every `/api/*` request here (see vercel.json rewrites) and runs
 * the Express app as a serverless function — there is no long-running server.
 * The app is imported from the COMPILED server output (`server/dist`), which the
 * `vercel-build` step produces before functions are bundled.
 *
 * The static React site (client/dist) is served by Vercel itself, not Express —
 * app.ts skips its static/SPA handlers when `process.env.VERCEL` is set.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — compiled JS output has no bundled type declarations; resolved at build time on Vercel.
import { createApp } from "../server/dist/app.js";

export default createApp();
