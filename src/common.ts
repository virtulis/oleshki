import { readFile } from 'fs/promises';

export interface Config {
	googleApiKey: string;
	spreadsheetId: string;
	sheetRange: string;
}

export const config: Config = JSON.parse(await readFile('config.json', 'utf8'));
