import { Component, createRef } from 'react';
import { Entry, EntryList } from '../entry';
import { createRoot } from 'react-dom/client';
import { MapView, MapViewState } from './map';
import dayjs from 'dayjs';
import { stringify } from 'csv-stringify/sync';
import * as Sentry from '@sentry/react';

Sentry.init({
	dsn: 'https://c8db0755be1f40308040c159a57facf4@o306148.ingest.sentry.io/4505333290631168',
});

interface AppState {
	clownMode?: boolean;
	updated?: string;
	entries?: Entry[];
	shown?: Entry[];
	selected?: Entry[];
	selecting?: boolean;
	done?: number;
	noPos?: number;
	options?: {
		status?: string[];
		urgent?: string[];
	};
	filter?: {
		status?: string[];
		urgent?: string[];
		animals?: boolean;
		remain?: boolean;
		rescued?: boolean;
	};
	mapState?: MapViewState;
	goToCoords?: string;
	drawer?: 'filters' | 'disclaimer';
}

export class App extends Component<{}, AppState> {

	mapView = createRef<MapView>();

	constructor(props: {}) {
		super(props);
		this.state = {
			clownMode: location.protocol == 'http:',
		};
	}
	
	render() {
		const {
			updated,
			shown,
			entries,
			done,
			noPos,
			options,
			filter,
			clownMode,
			selecting,
			selected,
			drawer,
			mapState,
			goToCoords,
		} = this.state;
		const updTime = updated && dayjs(updated) || null;
		const setFilter = (filter: AppState['filter']) => {
			const shown = this.filterEntries(entries!, filter);
			this.setState({ filter, shown });
		};
		const filterCount = (
			(filter?.status && Object.values(filter.status).filter(b => b).length || 0)
			+ (filter?.urgent && Object.values(filter.urgent).filter(b => b).length || 0)
			+ Number(!!filter?.animals)
		);
		return <div className="app">
			<div className="info">
				<div className="links">
					<div><a href="/evacuated.html">Эвакуированы ≡</a></div>
					<div><a href="/in_search.html">Пропавшие ≡</a></div>
				</div>
				<div className="counts">{shown?.length}/{entries?.length}</div>
				{drawer != 'filters' && <FilterConfig filter={filter} setFilter={setFilter} options={options} />}
				<div className="actions">
					<a className="mobile-toggle" onClick={() => this.setState({ drawer: drawer == 'filters' ? undefined : 'filters' })}>Фильтры ({filterCount})</a>
					{!selecting && <a onClick={() => this.setState({ selecting: true })}>Выделить</a>}
					{selecting && <a onClick={() => this.setState({ selecting: false, selected: undefined })}>{selected?.length || 0} - сбросить</a>}
					<a onClick={this.makeCsv}>CSV</a>
					<a onClick={this.copyListText}>Список</a>
				</div>
				<div className="map-coords">
					<input
						value={goToCoords ?? ''}
						onChange={e => this.setState({ goToCoords: e.currentTarget.value })}
						onFocus={e => e.currentTarget.select()}
						onKeyDown={e => { if (e.key == 'Enter') this.maybeGoToCoords(); }}
					/>
					<button onClick={this.maybeGoToCoords}>🡪</button>
				</div>
				<div className="time">
					{updTime?.isBefore(dayjs().subtract(5, 'minute')) && '⚠️ '}
					{updTime?.format('HH:mm:ss')}
				</div>
			</div>
			<MapView
				clownMode={!!clownMode}
				entries={entries}
				shown={shown}
				selected={selected}
				selecting={selecting}
				onUpdated={mapState => this.setState({ mapState })}
				onSelected={this.selectEntries}
				toggleSelected={this.toggleSelected}
				ref={this.mapView}
			/>
			{!!drawer && <div className="drawer">
				{drawer == 'filters' && <FilterConfig filter={filter} setFilter={setFilter} options={options} />}
				{drawer == 'disclaimer' && <div className="disclaimer">
					<span className="icon">⚠️</span>
					<div>
						Информация на карте обновляется с задержкой. Некоторые дома уже эвакуированы, но там, где мы не можем получить подтверждение, мы сохраняем метки на карте.<br />
						См. также списки <a href="/evacuated.html">эвакуированных</a> и <a href="/in_search.html">пропавших</a>.
					</div>
					<button onClick={this.hideDisclaimer}>OK</button>
				</div>}
			</div>}
		</div>;
	}
	
	componentDidMount() {
		this.reloadEntries();
		setInterval(this.reloadEntries, 20000);
		if (!sessionStorage.sawDisclaimer) this.setState({ drawer: 'disclaimer' });
	}
	
	filterEntries(all: Entry[], filter = this.state.filter, selected = this.state.selected) {
		const sel = new Set(selected?.map(e => e.id) ?? []);
		return all.filter(entry => sel.has(entry.id) || (
			entry.coords
			&& (!filter?.status || filter?.status.includes(entry.status!))
			&& (!filter?.urgent || filter?.urgent.includes(entry.urgent!))
			&& (!filter?.animals || !!entry.animals)
			&& (!entry.remain || filter?.remain)
			&& (!entry.rescued || filter?.rescued)
		));
	}
	
	reloadEntries = async () => {
	
		const list = (await fetch('/data/entries.json').then(res => res.json())) as EntryList;
		
		const { updated, done } = list;
		
		const entries = list.entries.filter(e => e.coords);
		
		const status = [...new Set(entries.map(e => e.status!).filter(s => !!s && s != 'вывезли' && s != 'решили остаться, запроса нет'))];
		const urgent = [...new Set(entries.map(e => e.urgent!).filter(s => !!s))];
		const options = { status, urgent };
		
		const noPos = list.entries.filter(e => !e.coords).length;
		const shown = this.filterEntries(list.entries, this.state.filter);
		
		this.setState({ updated, entries, done, noPos, shown, options });
		
	};
	
	selectEntries = (entries: Entry[]) => {
		const ex = this.state.selected ?? [];
		const selected = [
			...ex,
			...entries.filter(e => !ex.some(o => o.id == e.id)),
		];
		this.setState({ selected });
	};
	toggleSelected = (entry: Entry) => {
		console.log('toggleSelected');
		const ex = this.state.selected ?? [];
		const selected = ex.some(e => e.id == entry.id) ? ex.filter(e => e.id != entry.id) : [...ex, entry];
		this.setState({ selected });
	};
	getSelected() {
		const { mapState, shown, selected } = this.state;
		return selected?.length ? selected : shown?.filter(e => e.coords && mapState?.bounds.contains(e.coords));
	}
	
	makeCsv = (e: React.MouseEvent<HTMLAnchorElement>) => {
	
		const list = this.getSelected();
		if (!list?.length) return alert('Ничего не выбрано');
		
		const header = ['ID', 'Статус', 'Людей', 'Животных', 'Адрес', 'Адрес Р', 'Координаты', 'Телефон', 'Контактная инфа', 'Детали'];
		const rows = list.map(e => [
			e.id,
			// e.urgent,
			e.status,
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
	
	copyListText = async () => {
		
		const { clownMode } = this.state;
		
		const list = this.getSelected();
		if (!list?.length) return alert('Ничего не выбрано');
		
		const text = list.map(e => {
			const addr = !clownMode ? e.address : e.addressRu ?? e.address?.split(' / ')[0];
			return [
				// !!e.urgent && `❗ ${e.urgent}`,
				`👥 ${e.people ?? '?'}${e.animals ? ` + 🐾 ${e.animals}` : ''}`,
				addr && `🏠 ${addr}`,
				e.coords && `🌐 ${e.coords?.join(', ')}`,
				e.contact && `📞 ${e.contact}`,
				e.contactInfo && `💬 ${e.contactInfo}`,
				!clownMode && e.details && `ℹ️ ${e.details}`,
			].filter(v => !!v).map(s => (s as string).trim()).join('\n');
		}).join('\n\n');
		
		try {
			await navigator.clipboard.writeText(text);
		}
		catch (e) {
			Sentry?.captureException(e);
			alert(text);
		}
	
	};
	
	maybeGoToCoords = () => {
		
		const str = this.state.goToCoords?.trim();
		if (!str) return;
		
		const map = this.mapView.current!;
		
		if (str.match(/^#?(\d+)$/)) {
			const id = str.match(/^#?(\d+)$/)![1];
			const entry = this.state.entries?.find(e => e.id == id);
			if (!entry) return alert('Не нашлось');
			if (!entry.coords) return alert('Нет координат');
			if (this.state.shown?.some(e => e.id == entry.id)) {
				map.goToEntry(entry);
			}
			else {
				const selected = [...(this.state.selected || []), entry];
				const shown = this.filterEntries(this.state.entries!, this.state.filter, selected);
				this.setState({ shown, selected }, () => {
					map.goToEntry(entry);
				});
			}
			return;
		}
		
		const coords = str.split(/[,;]/).map(n => Number(n.trim()));
		if (coords?.length == 2 && coords.every(n => isFinite)) {
			map.goToCoords(coords);
			this.setState({ goToCoords: undefined });
		}
		else {
			alert(coords.join(', '));
		}
		
	};
	
	hideDisclaimer = () => {
		sessionStorage.sawDisclaimer = 'yes';
		this.setState({ drawer: undefined });
	};
	
}

function FilterConfig({ filter, setFilter, options }: {
	filter: AppState['filter'];
	setFilter: (filter: AppState['filter']) => void;
	options: AppState['options'];
}) {
	
	const check = (opt: string, dim: 'status' | 'urgent', val: boolean) => {
		const arr = filter?.[dim];
		const res = val ? [...(arr ?? []), opt] : arr?.filter(e => e != opt);
		const upd = { ...filter, [dim]: res?.length ? res : undefined };
		setFilter(upd);
	};
	
	return <div className="filters">
		{(['status'] as const).map(dim => <div className="filter-group" key={dim}>
			{options?.[dim]?.map(opt => <label key={opt}>
				<input type="checkbox" checked={!!filter?.[dim]?.includes(opt)} onChange={e => check(opt, dim, e.currentTarget.checked)} />
				<span>{opt}</span>
			</label>)}
		</div>)}
		<div className="filter-group">
			<label>
				<input type="checkbox" checked={!!filter?.animals} onChange={e => setFilter({ ...filter, animals: e.currentTarget.checked })} />
				<span>животные</span>
			</label>
		</div>
		<div className="filter-group">
			<label>
				<input type="checkbox" checked={!!filter?.remain} onChange={e => setFilter({ ...filter, remain: e.currentTarget.checked })} />
				<span>решили остаться</span>
			</label>
			<label>
				<input type="checkbox" checked={!!filter?.rescued} onChange={e => setFilter({ ...filter, rescued: e.currentTarget.checked })} />
				<span>эвакуированные</span>
			</label>
		</div>
	</div>;
}


const root = createRoot(document.getElementById('ctor')!);
root.render(<App />);

navigator.serviceWorker?.register('/worker.js', {
	scope: '/',
});
