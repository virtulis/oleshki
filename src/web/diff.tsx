import { DiffEntry, significantEntryFields } from '../entry.js';
import { Fragment } from 'react';
import dayjs from 'dayjs';

export function DiffTable({ diff }: { diff: DiffEntry[] }) {

	const print = (it: any) => typeof it == 'string' ? it : JSON.stringify(it);
	
	return <html>
		<head>
			<title>Oleshki</title>
			<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
			<style>{`

table {
	border-collapse: collapse;
	width: 100%;
	font-size: 12px;
}

th {
	font-weight: normal;
}

td {
	border: 1px solid #eee;
	padding: 6px;
}
td:first-child, th:first-child {
	white-space: nowrap;
}
td:nth-child(2) {
	word-break: break-word;
}
td.spacer {
	border: 0;
	height: 20px;
}
td.old {
	color: #aaa;
}

`}</style>
		</head>
		<body>
			<table>
				{diff.map((de, i) => <Fragment key={i}>
					{!!i && <tr><td className="spacer" colSpan={2} /></tr>}
					{significantEntryFields.map(key => <Fragment key={key}>
						<tr>
							<th>{key}</th>
							<td>{de.data[key]}</td>
						</tr>
						{de.changed[key] && <tr>
							<td>{dayjs(de.changed[key]).format('MMM DD HH:mm')}</td>
							<td className="old">{de.changed[key] ? de.first[key] : ''}</td>
						</tr>}
					</Fragment>)}
				</Fragment>)}
			</table>
		</body>
	</html>;
	
}
