import { Component, createRef } from 'react';
import L from 'leaflet';
import { Entry } from '../entry';
import { renderToString } from 'react-dom/server';
import { blueIcon, greyIcon, redIcon } from './markers';

import 'leaflet.locatecontrol';

interface MapProps {
	entries?: Entry[];
	shown?: Entry[];
	clownMode?: boolean;
}
interface MapState {

}

export class MapView extends Component<MapProps, MapState> {

	div = createRef<HTMLDivElement>();
	map!: L.Map;
	
	markers = new Map<string, L.Marker>;
	
	render() {
		return <div className="map" ref={this.div} />;
	}
	
	shouldComponentUpdate(nextProps: Readonly<MapProps>, nextState: Readonly<MapState>, nextContext: any) {
		if (nextProps.shown && nextProps.shown != this.props.shown) this.updateEntries(nextProps);
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
		}).setView(ll as L.LatLngTuple, zoom);
		const osm = L.tileLayer(`/osm/{z}/{x}/{y}.png`, {
			maxZoom: 19,
			attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		}).addTo(this.map);
		const visicom = new L.TileLayer(`/visicom/2.0.0/planet3/base/{z}/{x}/{y}.png${clownMode ? '?lang=ru' : ''}`, {
			attribution: '<a href=\'https://api.visicom.ua/\'>Визиком</a>',
			// subdomains: '123',
			maxZoom: 19,
			tms: true,
		}).addTo(this.map);
		L.control.layers({
			OSM: osm,
			Visicom: visicom,
		}).addTo(this.map);
		L.control.locate({}).addTo(this.map);
		
		this.map.on('moveend', this.saveState);
		this.map.on('zoomend', this.saveState);
		
		if (this.props.shown) this.updateEntries(this.props);
		
	}
	
	saveState = () => {
		const center = this.map.getCenter();
		const state = [center.lat.toFixed(6), center.lng.toFixed(6), this.map.getZoom()].join(',');
		history.replaceState(null, '', `#map=${state}`);
	};
	
	updateEntries({ entries, shown, clownMode }: MapProps) {
		const seen = new Set<string>();
		for (const entry of shown!) {
			if (!entry.coords) continue;
			const key = JSON.stringify([entry.id, entry.urgent, entry.status, entry.coords]);
			seen.add(key);
			if (!this.markers.has(key)) {
				this.markers.set(key, L.marker(entry.coords, {
					interactive: true,
					icon: entry.urgent ? redIcon : entry.certain ? blueIcon : greyIcon,
					zIndexOffset: entry.urgent ? 1000 : entry.certain ? 0 : -1000,
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

const dump = ['coords', 'urgent', 'status', 'certain', 'address', 'city', 'people', 'animals', 'contact', 'contactInfo', 'details'] as const;
const hide = ['details'];

function EntryPopup({ entry, clownMode }: { entry: Entry; clownMode?: boolean }) {
	return <div>
		{dump.filter(k => entry[k] && (!clownMode || !hide.includes(k))).map(k => <div>{k}: {String(entry[k])}</div>)}
	</div>;
}
