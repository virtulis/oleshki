import { sheets, sheets_v4 } from '@googleapis/sheets';
import { config } from './common.js';
import { mkdir, writeFile } from 'fs/promises';
import { Entry, EntryList } from './entry.js';
import dayjs from 'dayjs';
import { allStatuses, EntryStatus, hiddenStatuses } from './statuses.js';
import Schema$CellData = sheets_v4.Schema$CellData;
import { isIn } from './util.js';
import * as child_process from 'child_process';
import { promisify } from 'util';
import { OAuth2Client } from 'google-auth-library';

const execFile = promisify(child_process.execFile);

await mkdir('data/history', { recursive: true });
const fn = 'data/sheet.json';

export async function fetchSheet() {

	const auth = new OAuth2Client(config.googleApiKey);
	auth.setCredentials(config.googleOAuthToken);
	
	const sh = sheets({ version: 'v4', auth });

	const doc = await sh.spreadsheets.get({
		spreadsheetId: config.spreadsheetId,
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

	const val = (cd?: Schema$CellData) => {
		if (cd?.effectiveValue?.stringValue) return cd?.effectiveValue?.stringValue?.trim();
		if (cd?.effectiveValue?.numberValue) return String(cd?.effectiveValue?.numberValue)?.trim();
		return undefined;
	};

	const cols = {
		city: columns.findIndex(s => s.includes('Город')),
		coords: columns.findIndex(s => s.includes('Координаты')),
		address: columns.findIndex(s => s.includes('адрес рус / укр')),
		addressRu: columns.findIndex(s => s.includes('адрес по-русски')),
		people: columns.findIndex(s => s.includes('ство человек')),
		contact: columns.findIndex(s => s.includes('Контактный номер')),
		contactInfo: columns.findIndex(s => s.includes('Контакт для связи')),
		animals: columns.findIndex(s => s.includes('ство жив')),
		details: columns.findIndex(s => s.includes('Другие комм')),
		status: columns.findIndex(s => s.includes('статус')),
		urgent: columns.findIndex(s => s.includes('Срочность')),
	};
	const verbatim = ['address', 'addressRu', 'city', 'people', 'contact', 'contactInfo', 'animals', 'details'] as const;

	const entries = rowData.slice(1).filter(row => row.values?.slice(1)?.some(cd => !!val(cd))).map((row, i) => {
		const llMatch = val(row.values![cols.coords])?.match(/(\d+\.\d+)[,; ]\s*(\d+\.\d+)/);
		const coords = llMatch ? [llMatch[1], llMatch[2]].map(s => Number(s.trim())) : undefined;
		const allData = Object.fromEntries(row.values!.map((cd, i) => [columns[i], val(cd)]));
		const etc = Object.fromEntries(verbatim.map(k => [k, val(row.values![cols[k]])]).filter(r => !!r[1]));
		let status = val(row.values![cols.status])?.toLowerCase() as EntryStatus;
		const urgent = val(row.values![cols.urgent])?.toLowerCase();

		if (status as string == 'требуется евакуация') status = 'требуется эвакуация';
		if (status as string == 'спасатели уже работали, нет данных о статусе') status = 'была эвакуация, нет актуального статуса';

		if (isIn(status, hiddenStatuses)) return null;

		if (coords && !allStatuses.includes(status)) console.log('строка', i + 1, 'ID', val(row.values![0]), ':', 'неизв статус =', status);
		if (val(row.values![cols.coords]) && !coords) console.log('строка', i + 1, 'ID', val(row.values![0]), status, ':', 'координаты? =', val(row.values![cols.coords]));

		let id = val(row.values![0]);
		if (!id || !id.match(/^\w+$/)) {
			console.log('строка', i + 1, 'ID??? =', id);
			id = `R${i + 1}`;
		}

		return <Entry> {
			id,
			idx: i + 1,
			coords,
			...etc,
			status,
			urgent,
			remain: status == 'решили остаться, запроса нет',
			medical: status == 'медицина, требуются лекарства',
			uncertain: status?.includes('нет данных'),
			rescued: status == 'вывезли',
			data: allData,
		};
	}).filter(row => row && (row.coords || row.address || row.contact || row.details)) as Entry[];

	const done = entries.filter(e => e.status == 'вывезли').length;

	const list: EntryList = {
		updated: dayjs().format(),
		done,
		columns,
		mapping: cols,
		entries,
	};

	const histFn = `data/history/${dayjs().format()}.json`;
	const fullJson = JSON.stringify(list, null, '\t');
	await writeFile('data/entries.data.json', fullJson);
	await writeFile(histFn, fullJson);

	entries.forEach(e => e.data = undefined);
	await writeFile('data/entries.json', JSON.stringify(list, null, '\t'));

	console.log(list.updated, entries.length);

	await execFile('zstd', ['--rm', '-9', histFn]);

}

if (process.argv.includes('fetch')) {
	const data = await fetchSheet();
	await parseSheet(data);
}
// else if (process.argv.includes('parse')) {
// 	const data = JSON.parse(await readFile(fn, 'utf8'));
// 	await parseSheet(data);
// }
