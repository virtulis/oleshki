import { EntryList } from './entry.js';
import { readFile, writeFile } from 'fs/promises';
import { isSome, Maybe } from './util.js';
import damlev from 'damerau-levenshtein';
import { stringify } from 'csv-stringify/sync';
import { config } from './common.js';
import { parse } from 'csv-parse/sync';

interface SheetRow {
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
	city: Maybe<string>;
}

const norm = (s: string) => (s[0] || '').toUpperCase() + (s.slice(1) || '').toLowerCase().replace(/ё/ug, 'е');
const normArr = (a: Maybe<string>[]) => a.filter(isSome).map(norm);

const stripVowels = (str: string) => str.toLowerCase().replace(/^м/u, 'н').replace(/[аеёиоуюыэяйiієї]+/gui, '');

const allNames = new Set<string>(
	(Object.values(JSON.parse(await readFile(
		'src/data/names.json',
		'utf8',
	))).flat() as string[]).filter(isSome).filter(s => s.length).map(norm),
);
const allNamesList = [...allNames];
const allNameRegexes = allNamesList.map(name => new RegExp(`(^|[\\s\\n])(${name})`, 'ui'));

export async function parseSheetNames() {
	
	const list: EntryList = JSON.parse(await readFile('data/entries.data.json', 'utf-8'));
	
	const output: SheetRow[] = [];
	
	const suffixes: Record<string, number> = {};
	
	for (const entry of list.entries) {
		
		// console.log('----', entry.id);
		
		const batch: SheetRow[] = [];
		
		for (const field of ['contact', 'contactInfo', 'details'] as const) {
			
			const src = entry[field];
			if (!src || !src?.trim()) continue;
			// console.log(src);
			
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
				const year = src.slice(match.index! + match[0].length).match(
					/^[ ,)(]*(\d{1,2}[,.]\d{1,2}[,.]\d{4}|19\d{2}|2[012]\d{2}|\d{1,3} *[лрг+])?/
				)?.[1];
				const row: SheetRow = {
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
					city: entry.city,
				};
				batch.push(row);
				// console.log(JSON.stringify(row));
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
					batch.push(<SheetRow>{
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
		
		batch.sort((
			a,
			b,
		) => a.name1?.localeCompare(b.name1 ?? a.name1) || a.name2?.localeCompare(b.name2 ?? a.name2) || a.name3?.localeCompare(
			b.name3 ?? a.name3
		) || 0);
		const deduped = batch.filter((
			row,
			i,
		) => !(row.name1 == batch[i - 1]?.name1 && row.name2 == batch[i - 1]?.name2 && row.name3 == batch[i - 1]?.name3));
		output.push(...deduped);
		
	}
	
	// console.log(Object.entries(suffixes).sort((a, b) => b[1] - a[1]).map(s => s[0]).slice(0, 20).join('|'));
	
	
	// console.log(allNames);
	
	const maybeNotNames = new Set<string>();
	
	for (const row of output) {
		
		const { name1, name2, name3 } = row;
		
		row.name = (
			normArr([name2, name1, name3]).find(c => allNames.has(c))
			?? normArr([name2, name1, name3]).filter(n => n.length > 3).find(c => allNamesList.find(
				o => damlev(o, c).steps < 2
			))
		);
		
		row.patronym = normArr([name3, name2]).filter(n => n != row.name).find(c => c.match(
			/(ьича?|вича?|вн[ау]|їна)$/ui
		));
		
		if (!row.name) normArr([name1, name2, name3]).filter(s => s.length > 2).forEach(n => maybeNotNames.add(n));
		row.name ??= (name3 ? [name2, name1, name3] : [
			name1,
			name2,
			name3,
		]).filter(isSome).map(norm).find(n => n != row.patronym);
		
		row.surname = normArr([name1, name2, name3]).find(n => n != row.name && n != row.patronym);
		
		row.patronym ??= normArr([name3])[0];
		
	}
	
	await writeFile('data/maybe-not-names.json', JSON.stringify([...maybeNotNames].sort(), null, '\t'));
	
	await writeFile('data/names.hmm.csv', stringify(output.filter(
		r => [r.name1, r.name2, r.name3].filter(isSome).length != [r.name, r.surname, r.patronym].filter(isSome).length,
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

export async function fetchAirtable() {
	
	const api = 'https://api.airtable.com/v0';
	const auth = { headers: {
		Authorization: `Bearer ${config.airtableKey}`,
	} };
	
	// const airtable = new Airtable({ apiKey: config.airtableKey });
	// const base = airtable.base('appJlgaFtLGpcn9PM?');
	//
	// console.log(await base.makeRequest({ }));
	
	const evac = 'tblWDazlQ7QWbKb7d';
	const search = 'tblQalk7y2mO6dDlE';
	
	const res = await fetch(`${api}/${config.airtableBase}/${search}`, auth).then(res => res.json());
	res.records.forEach(console.log);
	
}

interface SheetRowEtc extends SheetRow {
	stripped: SheetRow;
}

interface ListRow {

	'ПІБ росийською / ФИО по-русски': string;
	'ПIБ': string;
	'Дата народження / Дата рождения': string;
	'статус': string;
	'Населений пункт / Населенный пункт': string;
	'Вулиця / Улица': string;
	'Будинок/ Дом': string;
	'Примітки / Примечания': string;
	'Контакт рідних/ хто шукає / Контакт родных/кто ищет': string;
	'Лінк на пошук, якщо немає контакту / Линк на  поиск, если нет контакта': string;
	'Населений пункт інший /Населенный пункт другой': string;
	'Час оновлення/ Время обновления': string;
	'Год рождения': string;
	'Рік народження / Год рождения': string;
	
	'record_id': string;
	
	rus: Maybe<{
		src: Maybe<string>;
		name: Maybe<string>;
		patronym: Maybe<string>;
		etc: Maybe<string>[];
		all: Maybe<string>[];
	}>;
	ukr: Maybe<{
		src: Maybe<string>;
		name: Maybe<string>;
		patronym: Maybe<string>;
		etc: Maybe<string>[];
		all: Maybe<string>[];
	}>;
	
}

const langs = ['rus', 'ukr'] as const;

export async function parseSearchNames() {

	const sheetRows: SheetRowEtc[] = JSON.parse(await readFile('data/names.json', 'utf-8'));
	for (const row of sheetRows) {
		row.stripped = { ...row };
		for (const k of ['name', 'surname', 'patronym'] as const) {
			if (row[k]) row.stripped[k] = stripVowels(row[k]!);
		}
		// console.log(row);
	}
	
	const listRows: ListRow[] = parse(
		await readFile('data/search.csv', 'utf-8').then(csv => csv.replace(/^\uFEFF/, '')),
		{ columns: true }
	);
	
	const sheetNames = new Set(sheetRows.map(r => r.name).filter(isSome).filter(n => n.length > 3));
	const sheetNamesList = [...sheetNames];
	const sheetNamesStripped = new Set(sheetNamesList.map(stripVowels).filter(n => n.length > 3));
	const sheetCities = new Set(sheetRows.map(r => r.city).filter(isSome).filter(n => n.length > 3));
	// console.log(sheetCities);
	
	// console.log(searchRows.filter(row => row['ПІБ росийською / ФИО по-русски'] && row['ПIБ']));
	
	const compare = (a: string, b: string) => {
		const len = Math.min(a.length, b.length);
		const dl = damlev(a, b);
		return Math.max(
			a == b ? 1 : 0,
			stripVowels(a) == stripVowels(b) ? 0.9 : 0,
			1 - dl.steps * 0.2,
			dl.similarity * 0.5,
			a.slice(0, len) == b.slice(0, len) ? Math.min(1, len / 2) : 0,
		);
	};
	
	const found = [];
	
	for (const lr of listRows) {
	
		for (const [srcKey, lang] of [['ПІБ росийською / ФИО по-русски', 'rus'], ['ПIБ', 'ukr']] as const) {
			
			const src = lr[srcKey];
			if (!src?.trim()) continue;
			
			const all = src.split(/[^\p{L}'"`’]+/gu).filter(s => s.trim() && !s.match(/^\d+$/)).map(norm);
			
			const exactName = (
				all.find(s => allNames.has(s))
				?? all.find(s => sheetNames.has(s))
			);
			const name = (
				exactName
				?? all.find(s => sheetNamesStripped.has(stripVowels(s)))
				?? all.find(s => sheetNamesList.some(o => damlev(o, s).steps < 2))
			);
			
			const patronym = normArr(all).filter(n => n != name).find(c => c.match(
				/(ьича?|вича?|вн[ау]|їна)$/ui
			));
			const etc = all.filter(s => s != name && s != patronym);
			
			// console.log(lr.record_id, src, all, name, patronym, etc);
			lr[lang] = { src, name, patronym, etc, all };
			
		}
		
		// const best = sheetRows.filter(sr => sr.name == name && sr.patronym == patronym && etc.some(s => sr.surname == s));
		// best.forEach(b => console.log('    ', b.name, b.patronym, b.surname));
		
		const options = sheetRows.map(sr => {
			let rank = 0;
			const sAll = [sr.name, sr.patronym, sr.surname].filter(isSome).map(s => s.replace(/\.$/, ''));
			for (const key of ['name', 'patronym'] as const) {
				const ref = sr[key]?.replace(/\.$/, '');
				if (!ref) continue;
				rank += -0.25 + Math.max(0, ...langs.map(l => lr[l]?.[key]).filter(isSome).flatMap(n => [
					compare(ref, n),
					...sAll.map(alt => compare(alt, n) * 0.5),
				]));
			}
			const srs = sr.surname?.replace(/\.$/, '');
			rank += !srs ? 0 : -0.25 + Math.max(0, ...langs.flatMap(l => lr[l]?.etc ?? []).filter(isSome).flatMap(n => [
				compare(srs, n),
				...sAll.map(alt => compare(alt, n) * 0.5),
			]));
			return { sr, rank };
		}).filter(o => o.rank > 1);
		options.sort((a, b) => b.rank - a.rank);
		// for (const { sr, rank } of options.slice(0, 10)) {
		// 	console.log(rank.toFixed(3).padStart(6), sr.name, sr.patronym, sr.surname);
		// }
		// console.log(best);
		
		const best = options[0];
		if (best && best.rank >= 1.5) {
			const { sr } = best;
			// console.log(best.rank.toFixed(3), lr.rus?.all.join(' ') ?? lr.ukr?.all.join(' '), lr.статус, '/', sr.status, sr.surname, sr.name, sr.patronym);
			const res = {
				
				rank: best.rank.toFixed(3),
				
				gs_id: sr.entry,
				at_id: lr.record_id,
				
				gs_full: [sr.name1, sr.name2, sr.name3].filter(isSome).join(' '),
				gs_name: sr.name,
				gs_patronym: sr.patronym,
				gs_surname: sr.surname,
				
				...Object.fromEntries(langs.flatMap(l => [
					[`at_${l}_src`, lr[l]?.src],
					[`at_${l}_name`, lr[l]?.name],
					[`at_${l}_patronym`, lr[l]?.patronym],
					[`at_${l}_etc`, lr[l]?.etc],
				])),
				
				gs_status: sr.status,
				at_status: lr.статус,
				
				gs_city: sr.city,
				at_city: lr['Населений пункт / Населенный пункт'] ?? lr['Населений пункт інший /Населенный пункт другой'],
				
			};
			console.log(res);
			found.push(res);
		}
		
		// console.log(lr.ПIБ, stripVowels(lr.ПIБ));
	
	}
	
	await writeFile('data/mapping.json', JSON.stringify(found, null, '\t'));
	await writeFile('data/mapping.csv', stringify(found, { header: true }));
	
}

if (process.argv.includes('parseSheetNames')) {
	await parseSheetNames();
}

// if (process.argv.includes('fetchAirtable')) {
// 	await fetchAirtable();
// }

if (process.argv.includes('parseSearchNames')) {
	await parseSearchNames();
}
