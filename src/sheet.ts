import { sheets, sheets_v4 } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';
import { config } from './common.js';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Entry } from './entry';

await mkdir('data', { recursive: true });
const fn = 'data/sheet.json';

export async function fetchSheet() {

	const key = config.googleApiKey;
	const sh = sheets({ version: 'v4' });
	
	const doc = await sh.spreadsheets.get({
		spreadsheetId: config.spreadsheetId,
		key,
		includeGridData: true,
		fields: 'sheets.data.rowData.values(userEnteredValue,effectiveValue)',
		ranges: [config.sheetRange],
	});
	
	await writeFile(fn, JSON.stringify(doc.data, null, '\t'));
	
	return doc.data;
	
}

export async function parseSheet(data: sheets_v4.Schema$Spreadsheet) {

	const rowData = data.sheets![0].data![0].rowData!;
	const columns = rowData[0]!.values!.map(
		(cd, i) => cd.effectiveValue?.stringValue?.replace(/\s+/g, ' ') ?? String(i)
	);
	const columnMap = Object.fromEntries(
		columns.map((c, i) => [c, i + 1]),
	);
	console.log(columnMap);
	
	const coordColumn = columns.findIndex(s => s.includes('оординаты'));
	
	const records = rowData.slice(1).map((row, i) => {
		const llMatch = row.values![coordColumn].effectiveValue?.stringValue?.match(/\d+\.\d+,\s*\d+\.\d+/);
		const coords = llMatch ? llMatch[0].split(',').map(s => Number(s.trim())) : null;
		const allData = Object.fromEntries(row.values!.map((cd, i) => [columns[i], cd?.effectiveValue?.stringValue]));
		return <Entry> {
			idx: i + 1,
			coords,
			data: allData,
		};
	});
	
	await writeFile('data/records.json', JSON.stringify(records, null, '\t'));

}

if (process.argv.includes('fetch')) {
	const data = await fetchSheet();
	await parseSheet(data);
}
// else if (process.argv.includes('parse')) {
// 	const data = JSON.parse(await readFile(fn, 'utf8'));
// 	await parseSheet(data);
// }
