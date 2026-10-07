import { betterAuth } from 'better-auth';
import { authOptions } from './auth.config.js';

// The CLI uses the same fields as the app, without creating a database client.
export const auth = betterAuth(authOptions);
