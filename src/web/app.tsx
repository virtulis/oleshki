import { Component, createRef } from 'react';
import { Entry, EntryList } from '../entry';
import { createRoot } from 'react-dom/client';
import { MapView, MapViewState } from './map';
import dayjs from 'dayjs';
import { stringify } from 'csv-stringify/sync';
import * as Sentry from '@sentry/react';
import { defaultStatuses, StatusCounts } from '../statuses';
import { isIn, maybe } from '../util';
import { languageConfig, t } from './i18n';
import { AuthForm, AuthState } from './auth.js';
import { defaltFilterState, FilterConfig, FilterState } from './filters.js';

Sentry.init({
	dsn: 'https://c8db0755be1f40308040c159a57facf4@o306148.ingest.sentry.io/4505333290631168',
});

interface AppState {
	clownMode?: boolean;
	language: 'ru' | 'uk';
	updated?: string;
	entries?: Entry[];
	shown?: Entry[];
	selected?: Entry[];
	selecting?: boolean;
	done?: number;
	noPos?: number;
	filter: FilterState;
	mapState?: MapViewState;
	goToCoords?: string;
	drawer?: 'filters' | 'disclaimer' | 'auth';
	auth: AuthState;
	statuses?: StatusCounts;
	lists?: string[];
}

export class App extends Component<{}, AppState> {

	mapView = createRef<MapView>();

	constructor(props: {}) {
		super(props);
		const clownMode = location.protocol == 'http:';
		const language = clownMode ? 'ru' : (typeof localStorage == 'object') && localStorage.language || 'ru';
		const auth: AuthState = maybe(localStorage.auth, JSON.parse) ?? {};
		this.state = {
			clownMode,
			language,
			auth,
			filter: defaltFilterState,
		};
		languageConfig.language = language;
	}
	
	render() {
		const {
			clownMode,
			language,
			updated,
			shown,
			entries,
			filter,
			lists,
			statuses,
			selecting,
			selected,
			drawer,
			goToCoords,
			auth,
		} = this.state;
		
		const updTime = updated && dayjs(updated) || null;
		const setFilter = (filter: AppState['filter']) => {
			const shown = this.filterEntries(entries!, filter);
			this.setState({ filter, shown });
		};
		const filterCount = (
			(filter?.statuses && Object.values(filter.statuses).filter(b => b).length || 0)
			// + (filter?.urgent && Object.values(filter.urgent).filter(b => b).length || 0)
			+ Number(!!filter?.animals)
		);
		return <div className="app">
			<div className="info">
				<div className="link-bar">
					<div className="links">
						<a href="/evacuated.html">{t('Эвакуированы')} ≡</a>
						<a href="https://search.oleshki.kludge.guru">{t('Общий поиск')} ≡</a>
					</div>
					{!clownMode && <div className="links right">
						<a onClick={this.toggleLanguage}>{language == 'ru' ? 'укр' : 'рус'}</a>
						<a onClick={() => this.setState({ drawer: drawer == 'auth' ? undefined : 'auth' })}>{auth.valid ? '🔑' : '🔒'}</a>
					</div>}
				</div>
				<div className="counts">{shown?.length}/{entries?.length}</div>
				{drawer != 'filters' && <FilterConfig
					filter={filter}
					setFilter={setFilter}
					statuses={statuses}
					lists={lists}
				/>}
				<div className="actions">
					
					<a className="mobile-toggle" onClick={() => this.setState({ drawer: drawer == 'filters' ? undefined : 'filters' })}>{t('Фильтры')} ({filterCount})</a>
					
					{!!auth.valid && <>
						{!selecting && <a onClick={() => this.setState({ selecting: true })}>{t('Выделить')}</a>}
						{selecting && <a onClick={() => this.setState({ selecting: false, selected: undefined })}>{selected?.length || 0} - {t('сбросить')}</a>}
						<a onClick={this.makeCsv}>CSV</a>
						<a onClick={this.copyListText}>{t('Список')}</a>
					</>}
					
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
				fetchData={this.fetchData}
			/>
			{!!drawer && <div className="drawer">
				{drawer == 'filters' && <FilterConfig filter={filter} setFilter={setFilter} statuses={statuses} />}
				{drawer == 'disclaimer' && <div className="disclaimer">
					<span className="icon">⚠️</span>
					<div>
						Информация на карте обновляется с задержкой. Некоторые дома уже эвакуированы, но там, где мы не можем получить подтверждение, мы сохраняем метки на карте.<br />
						См. также списки <a href="/evacuated.html">эвакуированных</a> и <a href="https://search.oleshki.kludge.guru/">поиск</a>.
					</div>
					<button onClick={this.hideDisclaimer}>OK</button>
				</div>}
				{drawer == 'auth' && <AuthForm key={String(!!auth.valid)} state={auth} onChange={this.updateAuth} />}
			</div>}
		</div>;
	}
	
	componentDidMount() {
		this.reloadEntries();
		setInterval(this.reloadEntries, 20000);
		if (!localStorage.sawDisclaimer && !sessionStorage.sawDisclaimer) this.setState({ drawer: 'disclaimer' });
	}
	
	filterEntries(all: Entry[], filter = this.state.filter, selected = this.state.selected) {
		console.log(filter);
		const sel = new Set(selected?.map(e => e.id) ?? []);
		return all.filter(entry => entry.coords && (
			sel.has(entry.id)
			|| (filter?.statuses && isIn(entry.status, filter.statuses))
			|| (filter?.animals && !!entry.animals)
			|| (filter?.lists && !!isIn(entry.list, filter.lists))
		));
	}

	fetchData = (src: string) => {
		const { auth } = this.state;
		return fetch(src, {
			headers: auth.valid ? {
				Authorization: `Basic ${btoa(`${auth.user}:${auth.password}`)}`,
			} : {},
		});
	};

	reloadEntries = async () => {

		const { auth } = this.state;
		const res = await this.fetchData(auth.valid ? '/data/entries.auth.json' : '/data/entries.json');

		if (res.status == 401 && auth.valid) {
			this.setState({ auth: { ...auth, valid: false } }, () => this.reloadEntries);
			return;
		}
		
		const list = await res.json() as EntryList;
		
		const { updated, done } = list;
		
		const entries = list.entries.filter(e => e.coords);
		const statuses = {} as StatusCounts;
		const listSet = new Set<string>();
		entries.forEach(e => {
			statuses[e.status] = (statuses[e.status] || 0) + 1;
			if (e.list) listSet.add(e.list);
		});
		const lists = [...listSet].sort();
		
		const noPos = list.entries.filter(e => !e.coords).length;
		const shown = this.filterEntries(list.entries, this.state.filter);
		
		this.setState({ updated, entries, done, noPos, shown, statuses, lists });
		
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
		if (!list?.length) return alert(t('Ничего не выбрано'));
		
		const header = ['ID', 'Статус', 'Людей', 'Животных', 'Адрес', 'Город', 'Адрес Р', 'Координаты', 'Телефон', 'Контактная инфа', 'Детали'];
		const rows = list.map(e => [
			e.id,
			// e.urgent,
			e.status,
			e.people,
			e.animals,
			e.city,
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
		if (!list?.length) return alert(t('Ничего не выбрано'));
		
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
			if (!entry) return alert(t('Не нашлось'));
			if (!entry.coords) return alert(t('Нет координат'));
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
		localStorage.sawDisclaimer = 'yes';
		this.setState({ drawer: undefined });
	};
	
	toggleLanguage = () => {
		const language = this.state.language == 'ru' ? 'uk' : 'ru';
		languageConfig.language = language;
		this.setState({ language });
		localStorage.language = language;
	};
	
	updateAuth = (auth: AuthState) => {
		this.setState({ auth }, this.reloadEntries);
		localStorage.auth = JSON.stringify(auth);
	};
	
}


const root = createRoot(document.getElementById('ctor')!);
root.render(<App />);

navigator.serviceWorker?.register('/worker.js', {
	scope: '/',
});
