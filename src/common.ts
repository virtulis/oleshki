import { readFile } from 'fs/promises';
import { Credentials, OAuth2ClientOptions } from 'google-auth-library';

export interface Config {
    googleApiKey: OAuth2ClientOptions;
    googleOAuthToken: Credentials;
    spreadsheetId: string;
	sheetId: number;
    sheetRange: string;
}

export const config: Config = JSON.parse(await readFile('config.json', 'utf8'));
