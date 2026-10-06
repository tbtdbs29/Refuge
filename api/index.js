// Vercel serverless entry: the whole Express app runs as one function.
// Static assets in public/ are served directly by Vercel's CDN (see vercel.json).
import { createApp } from '../src/app.js';

export default createApp();
