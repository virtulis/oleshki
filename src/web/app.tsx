import { Component } from 'react';
import { Entry, EntryList } from '../entry';
import { createRoot } from 'react-dom/client';
import { MapView, MapViewState } from './map';
import dayjs from 'dayjs';
import { stringify } from 'csv-stringify/sync';

interface AppState {
	clownMode?: boolean;
	updated?: string;
	entries?: Entry[];
	shown?: Entry[];
	done?: number;
	noPos?: number;
	options?: {
		status?: string[];
		urgent?: string[];
	};
	filter?: {
		status?: string[];
		urgent?: string[];
	};
	mapState?: MapViewState;
}

export class App extends Component<{}, AppState> {

	constructor(props: {}) {
		super(props);
		this.state = {
			clownMode: location.protocol == 'http:',
		};
	}
	
	render() {
		const { updated, shown, entries, done, noPos, options, filter, clownMode } = this.state;
		const updTime = updated && dayjs(updated) || null;
		const check = (opt: string, dim: 'status' | 'urgent', val: boolean) => {
			const arr = filter?.[dim];
			const res = val ? [...(arr ?? []), opt] : arr?.filter(e => e != opt);
			const upd = { ...filter, [dim]: res?.length ? res : undefined };
			const shown = this.filterEntries(entries!, upd);
			this.setState({ filter: upd, shown });
		};
		return <div className="app">
			<div className="info">
				<div className="counts">{shown?.length}/{entries?.length} | {noPos} без к. | ✔️{done} |</div>
				{(['urgent'] as const).map(dim => <div className="filters" key={dim}>{options?.[dim]?.map(opt => <label key={opt}>
					<input type="checkbox" checked={!!filter?.[dim]?.includes(opt)} onChange={e => check(opt, dim, e.currentTarget.checked)} />
					<span>{opt}</span>
				</label>)}</div>)}
				<div className="actions">
					<a onClick={this.makeCsv}>CSV</a>
				</div>
				<div className="time">
					{updTime?.isBefore(dayjs().subtract(5, 'minute')) && '⚠️ '}
					{updTime?.format('HH:mm:ss')}
				</div>
			</div>
			<MapView
				clownMode={!!clownMode}
				entries={this.state.entries}
				shown={this.state.shown}
				onUpdated={mapState => this.setState({ mapState })}
			/>
		</div>;
	}
	
	componentDidMount() {
		this.reloadEntries();
		setInterval(this.reloadEntries, 20000);
	}
	
	filterEntries(all: Entry[], filter: AppState['filter']) {
		return all.filter(entry => (
			entry.status != 'ВЫВЕЗЛИ'
			&& entry.coords
			&& (!filter?.status || filter?.status.includes(entry.status!))
			&& (!filter?.urgent || filter?.urgent.includes(entry.urgent!))
		));
	}
	
	reloadEntries = async () => {
	
		const list = (await fetch('/data/entries.json').then(res => res.json())) as EntryList;
		
		const { updated, done } = list;
		
		const entries = list.entries.filter(e => e.status != 'ВЫВЕЗЛИ' && e.coords);
		
		const status = [...new Set(entries.map(e => e.status!).filter(s => !!s))];
		const urgent = [...new Set(entries.map(e => e.urgent!).filter(s => !!s))];
		const options = { status, urgent };
		
		const noPos = list.entries.filter(e => !e.coords).length;
		const shown = this.filterEntries(list.entries, this.state.filter);
		
		this.setState({ updated, entries, done, noPos, shown, options });
		
	};
	
	makeCsv = (e: React.MouseEvent<HTMLAnchorElement>) => {
	
		const { mapState, shown } = this.state;
		
		if (!mapState || !shown) return alert('???');
		const visible = shown.filter(e => e.coords && mapState.bounds.contains(e.coords));
		
		const header = ['ID', 'Срочно', 'Людей', 'Животных', 'Адрес', 'Адрес Р', 'Координаты', 'Телефон', 'Контактная инфа', 'Детали'];
		const rows = visible.map(e => [
			e.id,
			e.urgent,
			e.people,
			e.animals,
			e.address,
			e.addressRu,
			e.coords?.join(', '),
			e.contact,
			e.contactInfo,
			e.details,
		]);
		
		const csv = stringify([header, ...rows]);
		
		const blob = new Blob([csv], { type: 'text/csv' });
		
		e.currentTarget.href = URL.createObjectURL(blob);
		e.currentTarget.download = `Карта-${dayjs().format('YYYYMMDDTHHmm')}.csv`;
		
	};
	
}

const root = createRoot(document.getElementById('ctor')!);
root.render(<App />);

navigator.serviceWorker.register('/worker.js', {
	scope: '/',
});
