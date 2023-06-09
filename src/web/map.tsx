import { Component, createRef } from 'react';
import L from 'leaflet';
import { Entry } from '../entry';
import { renderToString } from 'react-dom/server';
import { blueIcon, greyIcon, orangeIcon, redIcon, yellowIcon } from './markers';

import 'leaflet.locatecontrol';

interface MapProps {
	entries?: Entry[];
	shown?: Entry[];
	clownMode: boolean;
	onUpdated: (state: MapViewState) => void;
	onSelected: (entries: Entry[]) => void;
	selected?: Entry[];
	selecting?: boolean;
}
interface MapState {

}
export interface MapViewState {
	bounds: L.LatLngBounds;
	center: L.LatLng;
	zoom: number;
}

export class MapView extends Component<MapProps, MapState> {

	div = createRef<HTMLDivElement>();
	map!: L.Map;
	
	markers = new Map<string, L.Marker>;
	selection?: L.Rectangle;
	selectionFrom?: L.LatLng;
	
	render() {
		return <div className="map" ref={this.div} />;
	}
	
	shouldComponentUpdate(nextProps: Readonly<MapProps>, nextState: Readonly<MapState>, nextContext: any) {
		if (nextProps.shown && (nextProps.shown != this.props.shown || nextProps.selected != this.props.selected)) this.updateEntries(nextProps);
		return false;
	}
	
	componentDidMount() {
	
		const { clownMode } = this.props;
		
		const params = location.hash ? new URLSearchParams(location.hash.slice(1)) : null;
		const saved = params?.get('map')?.split(',').map(Number);
		const ll = saved?.slice(0, 2) ?? [46.61549, 32.69943];
		const zoom = saved?.[2] ?? 11;
	
		this.map = L.map(this.div.current!, {
			attributionControl: !clownMode,
		});
		
		const osm = L.tileLayer(`/osm/{z}/{x}/{y}.png`, {
			maxZoom: 19,
			attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		});
		const visicom = new L.TileLayer(`/visicom/2.0.0/planet3/base/{z}/{x}/{y}.png${clownMode ? '?lang=ru' : ''}`, {
			attribution: '<a href=\'https://api.visicom.ua/\'>Визиком</a>',
			// subdomains: '123',
			maxZoom: 19,
			tms: true,
		}).addTo(this.map);
		L.control.locate({}).addTo(this.map);
		
		const bounds = { n: 46.70577000000003, s: 46.442814000000055, w: 32.47389300000003, e: 32.71770800000007 };
		const maxar = L.imageOverlay(`/104001008763D300.jpg`, [[bounds.n, bounds.w], [bounds.s, bounds.e]]);
		
		L.control.layers({
			OSM: osm,
			Visicom: visicom,
		}, clownMode ? {} : {
			maxar,
		}).addTo(this.map);
		
		this.map.on('moveend', this.saveState);
		this.map.on('zoomend', this.saveState);
		this.map.on('load', this.saveState);
		
		this.map.on('mousedown', event => {
			if (this.selection) this.selection.remove();
			if (!this.props.selecting || event.originalEvent.button) return;
			this.selectionFrom = event.latlng;
			this.selection = new L.Rectangle(new L.LatLngBounds(event.latlng, event.latlng), {
				color: '#f80',
			}).addTo(this.map);
			event.originalEvent.stopImmediatePropagation();
			event.originalEvent.preventDefault();
		});
		this.map.on('mousemove', event => {
			if (!this.selection || !this.selectionFrom) return;
			this.selection.setBounds(new L.LatLngBounds(this.selectionFrom, event.latlng));
			event.originalEvent.stopImmediatePropagation();
			event.originalEvent.preventDefault();
		});
		this.map.on('mouseup', event => {
			if (!this.selection || !this.selectionFrom) return;
			event.originalEvent.stopImmediatePropagation();
			event.originalEvent.preventDefault();
			const bounds = this.selection.getBounds();
			const add = this.props.shown!.filter(e => e.coords && bounds.contains(e.coords));
			this.props.onSelected(add);
			this.selection.remove();
			this.selection = undefined;
		});
		
		this.map.setView(ll as L.LatLngTuple, zoom);
		
		if (this.props.shown) this.updateEntries(this.props);
		
	}
	
	saveState = () => {
		const bounds = this.map.getBounds();
		const center = this.map.getCenter();
		const zoom = this.map.getZoom();
		this.props.onUpdated({ bounds, center, zoom });
		const state = [center.lat.toFixed(6), center.lng.toFixed(6), zoom].join(',');
		history.replaceState(null, '', `#map=${state}`);
	};
	
	updateEntries({ entries, shown, selected, clownMode }: MapProps) {
		const seen = new Set<string>();
		for (const entry of shown!) {
			if (!entry.coords) continue;
			const mark = !!selected?.some(e => e.id == entry.id);
			const key = JSON.stringify([entry.id, entry.urgent, entry.status, entry.coords, mark]);
			seen.add(key);
			if (!this.markers.has(key)) {
				this.markers.set(key, L.marker(entry.coords, {
					interactive: true,
					icon: mark ? yellowIcon : entry.urgent ? redIcon : entry.certain ? blueIcon : greyIcon,
					// zIndexOffset: entry.urgent ? 1000 : entry.certain ? 0 : -1000,
				}).addTo(this.map).bindPopup(layer => renderToString(<EntryPopup entry={entry} clownMode={clownMode} />)));
			}
		}
		for (const [key, marker] of this.markers.entries()) {
			if (seen.has(key)) continue;
			// console.log('rm', key);
			marker.remove();
			this.markers.delete(key);
		}
	}
	
}

export function EntryPopup({ entry, clownMode }: { entry: Entry; clownMode?: boolean }) {
	const addr = !clownMode ? entry.address : entry.addressRu ?? entry.address?.split(' / ')[0];
	return <div className="popup">
		<div className="id">
			<strong>#{entry.id}</strong>
			{entry.urgent ? <strong> - {entry.urgent}</strong> : ''}
			{entry.status && entry.status != 'добавлено' ? <em> - {entry.status}</em> : ''}
			{'\n'}
		</div>
		<div className="people">
			<span title="Людей">
				👥{' '}
				{entry.people ?? '?'}
			</span>
			{!!entry.animals && <span title="Животных">
				{' + 🐾 '}
				{entry.animals}
			</span>}
			{'\n'}
		</div>
		{!!addr && <div title="Адрес">🏠 {addr}{'\n'}</div>}
		{/*{!!entry.city && <div title="Город/село">🏢 {entry.city}</div>}*/}
		<div className="Координаты">🌐 {entry.coords?.join(', ')}{'\n'}</div>
		{!!entry.contact && <div title="Телефон">📞 {entry.contact}{'\n'}</div>}
		{!!entry.contactInfo && <div title="Контактная информация">💬 {entry.contactInfo}{'\n'}</div>}
		{!clownMode && !!entry.details && <div title="Детали">ℹ️ {entry.details}{'\n'}</div>}
	</div>;
}
