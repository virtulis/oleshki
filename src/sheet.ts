import { sheets, sheets_v4 } from '@googleapis/sheets';
import { config } from './common.js';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { DiffEntry, Entry, EntryList, significantEntryFields } from './entry.js';
import dayjs from 'dayjs';
import { allStatuses, EntryStatus, hiddenStatuses } from './statuses.js';
import Schema$CellData = sheets_v4.Schema$CellData;
import { isIn, isNone, isSome, maybe, Maybe, pick } from './util.js';
import * as child_process from 'child_process';
import { promisify } from 'util';
import { OAuth2Client } from 'google-auth-library';
import { stringify } from 'csv-stringify/sync';
import path from 'path';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { DiffTable } from './web/diff.js';
import damlev from 'damerau-levenshtein';

const execFile = promisify(child_process.execFile);

await mkdir('data/history', { recursive: true });
const fn = 'data/sheet.json';

const auth = new OAuth2Client(config.googleApiKey);
auth.setCredentials(config.googleOAuthToken);

const sh = sheets({ version: 'v4', auth });

export async function fetchSheet() {

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

	const updated = dayjs().format();

	const rowData = data.sheets![0].data![0].rowData!;
	const columns = rowData[0]!.values!.map(
		(cd, i) => cd.effectiveValue?.stringValue?.replace(/\s+/g, ' ') ?? String(i)
	);

	const val = (cd?: Schema$CellData) => {
		if (cd?.effectiveValue?.stringValue) return cd?.effectiveValue?.stringValue?.trim();
		if (cd?.effectiveValue?.numberValue) return String(cd?.effectiveValue?.numberValue)?.trim();
		return undefined;
	};
	
	const findCol = (str: string) => {
		const i = columns.findIndex(s => s.toLowerCase().includes(str.toLowerCase()));
		if (i >= 0) return i;
		console.log('???', str);
		return null;
	};

	const cols = {
		city: findCol('Город'),
		coords: findCol('Координаты'),
		address: findCol('адрес рус / укр'),
		addressRu: findCol('адрес по-русски'),
		people: findCol('ство человек'),
		contact: findCol('Контактный номер'),
		contactInfo: findCol('Контакт для связи'),
		animals: findCol('ство жив'),
		details: findCol('Другие комм'),
		publicDetails: findCol('комментарий на карту'),
		status: findCol('статус'),
		list: findCol('выгрузка'),
	};
	
	console.log('---');
	
	for (const [key, idx] of Object.entries(cols)) {
		console.log(key.padEnd(14), String(idx).padStart(4), columns[idx!]);
	}
	
	const coordCol = cols.coords;
	const statusCol = cols.status;
	if (!isSome(coordCol)) throw new Error('No coords column');
	if (!isSome(statusCol)) throw new Error('No status column');
	
	const verbatim = ['address', 'addressRu', 'city', 'people', 'contact', 'contactInfo', 'animals', 'details', 'publicDetails', 'list'] as const;
	
	console.log('---');

	const entries = rowData.slice(1).filter(row => row.values?.slice(1)?.some(cd => !!val(cd))).map((row, i) => {
		const llMatch = val(row.values![coordCol])?.match(/(\d+\.\d+)[,; ]\s*(\d+\.\d+)/);
		const coords = llMatch ? [llMatch[1], llMatch[2]].map(s => Number(s.trim())) : undefined;
		const allData = Object.fromEntries(row.values!.map((cd, i) => [columns[i], val(cd)]));
		const etc = Object.fromEntries(verbatim.map(k => [k, val(row.values![cols[k]!])]).filter(r => !!r[1]));
		let status = val(row.values![statusCol])?.toLowerCase() as EntryStatus;
		// const urgent = val(row.values![cols.urgent])?.toLowerCase();

		if (status as string == 'требуется евакуация') status = 'требуется эвакуация';
		if (status as string == 'спасатели уже работали, нет данных о статусе') status = 'была эвакуация, нет актуальных данных';
		if (status as string == 'была эвакуация, нет актуального статуса') status = 'была эвакуация, нет актуальных данных';

		if (isIn(status, hiddenStatuses)) return null;

		if (coords && !allStatuses.includes(status)) console.log('строка', i + 1, 'ID', val(row.values![0]), ':', 'неизв статус =', status);
		if (val(row.values![coordCol]) && !coords) console.log('строка', i + 1, 'ID', val(row.values![0]), status, ':', 'координаты? =', val(row.values![coordCol]));

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
			// urgent,
			remain: status == 'пока остаются, запроса нет',
			medical: status == 'медицина, требуются лекарства',
			uncertain: status?.includes('нет данных'),
			rescued: status == 'вывезли',
			data: allData,
		};
	}).filter(row => row && (row.coords || row.address || row.contact || row.details)) as Entry[];

	const done = entries.filter(e => e.status == 'вывезли').length;
	
	const list: EntryList = {
		updated,
		done,
		columns,
		mapping: cols,
		entries,
	};

	const histFn = `data/history/${updated}.json`;
	const fullJson = JSON.stringify(list, null, '\t');
	await writeFile('data/entries.data.json', fullJson);
	await writeFile(histFn, fullJson);
	
	entries.forEach(e => {
		delete e.data;
	});
	await writeFile('data/entries.auth.json', JSON.stringify(list, null, '\t'));

	entries.forEach(e => {
		delete e.contact;
		delete e.contactInfo;
		delete e.details;
		delete e.list;
	});
	await writeFile('data/entries.json', JSON.stringify(list, null, '\t'));
	
	console.log('---');
	console.log(list.updated, entries.length);

	await execFile('zstd', ['--rm', '-9', histFn]);
	
	await writeFile('data/updated.txt', updated);
	
	

}

async function cleanUpDetails() {
	
	const list: EntryList = JSON.parse(await readFile('data/entries.data.json', 'utf-8'));
	
	const requests: sheets_v4.Schema$Request[] = [];
	
	if (isNone(list.mapping.publicDetails)) throw new Error('No column');
	const column = list.mapping.publicDetails;
	
	for (const entry of list.entries) {
		
		if (!entry.details?.trim() || !entry.coords) continue;
		// if (entry.publicDetails) continue;
		
		// const remover = (s: string) => s.replace(/./g, '$&̶');
		// const remover = (s: string) => s.replace(/./g, '•');
		const remover = '▒▒▒▒';
		
		const publicDetails = entry.details
			.replace(/(?<!\p{Alpha})Тел\W?\s*[-+0-9\s)(]+/igu, remover)
			.replace(/(?<!\p{Alpha})\+(380|7)[-+0-9\s)(]+/igu, remover)
			.replace(/((?<!\p{Alpha})\p{Lu}\p{Ll}+\s*){2,}/gu, remover)
			.replace(/((?<!\p{Alpha})\p{Lu}\p{Ll}+\s+)(\p{Lu}\.?\s*){1,2}/gu, remover)
			.replace(/https:\S+/gu, remover)
			.replace(/[-+0-9)(]{8,}/igu, remover)
			.replace(/[-+0-9)(]{2,}\s*[-0-9]{2,}[-0-9\s]+/igu, remover)
			.trim();
		
		// console.log('-----------');
		// console.log(entry.id, '@', entry.idx);
		// console.log(publicDetails);
		
		requests.push({
			updateCells: {
				fields: 'userEnteredValue',
				range: {
					sheetId: config.sheetId,
					startColumnIndex: column,
					startRowIndex: entry.idx,
					endColumnIndex: column + 1,
					endRowIndex: entry.idx + 1,
				},
				// range: {},
				rows: [{ values: [{ userEnteredValue: { stringValue: publicDetails } }] }],
			},
		});
		// break;
		// if (requests.length > 10) break;
		
	}
	
	requests.forEach(r => console.log(JSON.stringify(r)));
	
	if (requests.length) await sh.spreadsheets.batchUpdate({
		spreadsheetId: config.spreadsheetId,
		requestBody: {
			requests,
			includeSpreadsheetInResponse: false,
		},
	});
	
}

async function dumpNames() {
	
	const list: EntryList = JSON.parse(await readFile('data/entries.data.json', 'utf-8'));
	
	type Row = {
		entry: Maybe<string>;
		field: Maybe<string>;
		name1: Maybe<string>;
		name2: Maybe<string>;
		name3: Maybe<string>;
		name: Maybe<string>;
		surname: Maybe<string>;
		patronym: Maybe<string>;
		year: Maybe<string>;
		status: Maybe<string>;
		text: Maybe<string>;
	};
	const output: Row[] = [];
	
	const norm = (s: string) => s[0].toUpperCase() + s.slice(1).toLowerCase();
	const normArr = (a: Maybe<string>[]) => a.filter(isSome).map(norm);
	
	const suffixes: Record<string, number> = {};
	const allNames = new Set<string>(
		(Object.values(JSON.parse(await readFile('src/data/names.json', 'utf8'))).flat() as string[]).filter(isSome).filter(s => s.length).map(norm)
	);
	const allNamesList = [...allNames];
	const allNameRegexes = allNamesList.map(name => new RegExp(`(^|[\\s\\n])(${name})`, 'ui'));
	
	for (const entry of list.entries) {
		
		console.log('----', entry.id);
		
		const batch: Row[] = [];
		
		for (const field of ['contact', 'contactInfo', 'details'] as const) {
			
			const src = entry[field];
			if (!src || !src?.trim()) continue;
			console.log(src);
			
			const matches = [
				/(?<name1>(?<!\p{Alpha})\p{Lu}[\p{Ll}'"`’]+) +(?<name2>\p{Lu}\.|\p{Lu}[\p{Ll}'"`’]{3,}) *(?<name3>\p{Lu}\.|\p{Lu}[\p{Ll}'"`’]{3,})?/gu,
				/(?<name1>\p{Lu}[\p{Alpha}'"`’]+) +(?<name2>\p{Lu}[\p{Alpha}'"`’]+) +(?<name3>\p{Lu}[\p{Alpha}'"`’]+(ьича?|вича?|вн[ау]|ЬИЧА?|ВИЧА?|ВН[АУ]))/gu,
				/(?<name1>\p{Lu}[\p{Alpha}'"`’]+(нко|ова|кий|ина|ков|чук|ька|кая|іна|нов|ева|ник|лов|нюк|ець|єва|вич|хін|сюк|НКО|ОВА|КИЙ|ИНА|КОВ|ЧУК|ЬКА|КАЯ|ІНА|НОВ|ЕВА|НИК|ЛОВ|НЮК|ЕЦЬ|ЄВА|ВИЧ|ХІН|СЮК)) +(?<name2>\p{Lu}([\p{Alpha}'"`’]+|\.?)) *(?<name3>\p{Lu}([\p{Alpha}'"`’]+|\.?))?/gu,
				// /(?<name2>[\p{Alpha}'"`’]+)+ (?<name1>[\p{Alpha}'"`’]+(нко|ова|кий|ина|ков|чук|ька|кая|іна|нов|ева|ник|лов|нюк|ець|єва|хін|сюк))/gui,
				// /(?<name1>[\p{Alpha}'"`’]+) (?<name2>[\p{Alpha}'"`’]+) (?<name3>[\p{Alpha}'"`’]+)/gui
			].flatMap(reg => [...src.matchAll(reg)]);
			// console.log([...matches]);
			
			for (const match of matches) {
				const { name1, name2, name3 } = match.groups!;
				const year = src.slice(match.index! + match[0].length).match(/^[ ,)(]*(\d{1,2}[,.]\d{1,2}[,.]\d{4}|19\d{2}|2[012]\d{2}|\d{1,3} *[лрг+])?/)?.[1];
				const row: Row = {
					entry: entry.id,
					field,
					name1,
					name2,
					name3,
					name: null,
					surname: null,
					patronym: null,
					year,
					status: entry.status,
					text: src?.replace(/\s+/mg, ' '),
				};
				batch.push(row);
				console.log(JSON.stringify(row));
				// if (name1) {
				// 	suffixes[name1.slice(-3)] = (suffixes[name1.slice(-3)] || 0) + 1;
				// }
			}
			
		}
		
		if (!batch.length) {
			for (const field of ['contact', 'contactInfo', 'details'] as const) {
				const src = entry[field];
				if (!src) continue;
				for (const regex of allNameRegexes) {
					const match = src.match(regex);
					if (!match) continue;
					const name = match[1];
					batch.push(<Row> {
						entry: entry.id,
						field,
						name1: null,
						name2: name,
						name3: null,
						name,
						surname: null,
						patronym: null,
						year: null,
						status: entry.status,
						text: src?.replace(/\s+/mg, ' '),
					});
				}
			}
		}
		
		batch.sort((a, b) => a.name1?.localeCompare(b.name1 ?? a.name1) || a.name2?.localeCompare(b.name2 ?? a.name2) || a.name3?.localeCompare(b.name3 ?? a.name3) || 0);
		const deduped = batch.filter((row, i) => !(row.name1 == batch[i - 1]?.name1 && row.name2 == batch[i - 1]?.name2 && row.name3 == batch[i - 1]?.name3));
		output.push(...deduped);
		
	}
	
	// console.log(Object.entries(suffixes).sort((a, b) => b[1] - a[1]).map(s => s[0]).slice(0, 20).join('|'));
	
	
	// console.log(allNames);
	
	const maybeNotNames = new Set<string>();
	
	for (const row of output) {
	
		const { name1, name2, name3 } = row;
		
		row.name = (
			normArr([name2, name1, name3]).find(c => allNames.has(c))
			?? normArr([name2, name1, name3]).filter(n => n.length > 3).find(c => allNamesList.find(o => damlev(o, c).steps < 2))
		);
		
		row.patronym = normArr([name3, name2]).filter(n => n != row.name).find(c => c.match(/(ьича?|вича?|вн[ау]|їна)$/ui));
		
		if (!row.name) normArr([name1, name2, name3]).filter(s => s.length > 2).forEach(n => maybeNotNames.add(n));
		row.name ??= (name3 ? [name2, name1, name3] : [name1, name2, name3]).filter(isSome).map(norm).find(n => n != row.patronym);
		
		row.surname = normArr([name1, name2, name3]).find(n => n != row.name && n != row.patronym);
		
		row.patronym ??= normArr([name3])[0];
		
	}
	
	await writeFile('data/maybe-not-names.json', JSON.stringify([...maybeNotNames].sort(), null, '\t'));
	
	await writeFile('data/names.hmm.csv', stringify(output.filter(
		r => [r.name1, r.name2, r.name3].filter(isSome).length != [r.name, r.surname, r.patronym].filter(isSome).length
	), { header: true }));
	
	for (const k of ['name', 'surname', 'patronym'] as const) {
		const uniq = new Set<string>();
		for (const row of output) {
			if (row[k]) uniq.add(row[k]!);
		}
		await writeFile(`data/uniq.${k}.txt`, [...uniq].join('\n'));
	}
	
	await writeFile('data/names.json', JSON.stringify(output, null, '\t'));
	await writeFile('data/names.csv', stringify(output, { header: true }));
	
}

async function diffLists() {
	
	const till = dayjs();
	const sinceThresh = till.subtract(72, 'hour');
	
	const files = await readdir('data/history');
	files.sort();
	const lists = files.filter(fn => dayjs(path.parse(fn).name.replace('.json', '')).isAfter(sinceThresh));
	
	// console.log(lists);
	
	const str = await execFile('zstdcat', [`data/history/${lists[0]}`], { maxBuffer: 256 * 1024 * 1024 });
	const first: EntryList = JSON.parse(str.stdout);
	const entries = new Map<string, DiffEntry>;
	
	const entryData = (entry: Entry) => Object.fromEntries(significantEntryFields.map(
		key => [key, maybe(entry[key], v => typeof v == 'string' ? v.trim() : v)]
	));
	
	for (const entry of first.entries) {
		const data = entryData(entry);
		entries.set(entry.id, {
			id: entry.id,
			data: { ...data },
			changed: {},
			previous: { ...data },
			first: { ...data },
			lastChange: undefined,
		});
	}
	
	const keys: Record<string, number> = {};
	
	let lastParsed = dayjs(first.updated);
	
	for (const fn of lists) {
		
		if (dayjs(path.parse(fn).name.replace('.json', '')).diff(lastParsed, 'minute') < 60) continue;
		
		const str = await execFile('zstdcat', [`data/history/${fn}`], { maxBuffer: 256 * 1024 * 1024 });
		const list: EntryList = JSON.parse(str.stdout);
		
		let count = 0;
		let undid = 0;
		
		for (const entry of list.entries) {
			
			if (!entries.has(entry.id)) {
				const data = entryData(entry);
				entries.set(entry.id, {
					id: entry.id,
					data: { ...data },
					changed: {},
					previous: { ...data },
					first: { ...data },
					lastChange: undefined,
				});
			}
			const rec = entries.get(entry.id)!;
			
			for (const key of significantEntryFields) {
			
				const val = maybe(entry[key], v => typeof v == 'string' ? v.trim() : v);
				if (rec.data[key] == val) continue;
				if (typeof val == 'object' && JSON.stringify(val) == JSON.stringify(rec.data[key])) continue;
				
				if (entry.id == '1103' && key == 'addressRu') {
					console.log(fn);
					console.log(entry[key]);
					console.log(rec.data[key]);
					console.log(rec.previous[key]);
					console.log(rec.first[key]);
					console.log(rec.first[key] == val);
				}
				
				if (rec.first[key] == val) {
					undid--;
					rec.data[key] = val;
					delete rec.changed[key];
					delete rec.previous[key];
					continue;
				}
				
				count++;
				keys[key] = (keys[key] || 0) + 1;
				rec.previous[key] = rec.data[key];
				rec.data[key] = val;
				rec.changed[key] = list.updated;
				rec.lastChange = list.updated;
				
			}
			
		}
		
		// console.log(fn, count, undid);
		lastParsed = dayjs(list.updated);
		
	}
	
	console.log(keys);
	
	for (const de of entries.values()) {
		if (!de.lastChange) continue;
		console.log(de.lastChange, Object.values(de.changed).sort().reverse()[0]);
		de.lastChange = Object.values(de.changed).sort().reverse()[0];
	}
	
	const result = [...entries.values()]
		.filter(de => !!de.lastChange)
		.sort((a, b) => b.lastChange!.localeCompare(a.lastChange!));
		
	await writeFile('data/diff.json', JSON.stringify(result, null, '\t'));
	
}

async function printDiff() {
	const diff: DiffEntry[] = JSON.parse(await readFile('data/diff.json', 'utf-8'));
	const html = renderToString(createElement(DiffTable, { diff }));
	await writeFile('data/diff.html', html);
}

if (process.argv.includes('fetch')) {
	const data = await fetchSheet();
	await parseSheet(data);
}

if (process.argv.includes('cleanup')) {
	await cleanUpDetails();
}
if (process.argv.includes('dumpNames')) {
	await dumpNames();
}

if (process.argv.includes('diff')) {
	await diffLists();
}
if (process.argv.includes('printDiff')) {
	await printDiff();
}

