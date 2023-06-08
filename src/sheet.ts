import { sheets, sheets_v4 } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';
import { config } from './common.js';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Entry, EntryList } from './entry';
import dayjs from 'dayjs';

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
	
	const cols = {
		coords: columns.findIndex(s => s.includes('Координаты')),
		address: columns.findIndex(s => s.includes('Адрес')),
		people: columns.findIndex(s => s.includes('ство человек')),
		contact: columns.findIndex(s => s.includes('Контакт')),
		animals: columns.findIndex(s => s.includes('Тварини')),
		details: columns.findIndex(s => s.includes('Деталі')),
		status: columns.findIndex(s => s.includes('Статус')),
		tag: columns.findIndex(s => s.includes('Терміново')),
	};
	const verbatim = ['address', 'people', 'contact', 'animals', 'details', 'status', 'tag'] as const;
	
	const entries = rowData.slice(1).map((row, i) => {
		const llMatch = row.values![cols.coords].effectiveValue?.stringValue?.match(/\d+\.\d+,\s*\d+\.\d+/);
		const coords = llMatch ? llMatch[0].split(',').map(s => Number(s.trim())) : null;
		const certain = !!coords && row.values![cols.coords].userEnteredValue?.stringValue?.[0] != '=';
		const allData = Object.fromEntries(row.values!.map((cd, i) => [columns[i], cd?.effectiveValue?.stringValue]));
		const etc = Object.fromEntries(verbatim.map(k => [k, row.values![cols[k]].effectiveValue?.stringValue]).filter(r => !!r[1]));
		return <Entry> {
			idx: i + 1,
			coords,
			certain,
			...etc,
			data: allData,
		};
	});
	
	const list: EntryList = {
		updated: dayjs().format(),
		entries,
	};
	
	await writeFile('data/entries.json', JSON.stringify(list, null, '\t'));

}

if (process.argv.includes('fetch')) {
	const data = await fetchSheet();
	await parseSheet(data);
}
// else if (process.argv.includes('parse')) {
// 	const data = JSON.parse(await readFile(fn, 'utf8'));
// 	await parseSheet(data);
// }
