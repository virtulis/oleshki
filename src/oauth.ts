import { OAuth2Client } from 'google-auth-library';
import { config } from './common.js';

const auth = new OAuth2Client(config.googleApiKey);
console.log(auth.generateAuthUrl({ scope: 'https://www.googleapis.com/auth/spreadsheets' }));

const { tokens } = await auth.getToken(process.argv[2]);
console.log(tokens);

auth.setCredentials(tokens);
