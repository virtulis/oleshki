import L from 'leaflet';

const img = '/leaflet-color-markers/img/';

const colors = [
	
	'blue',
	'red',
	'green',
	'orange',
	'yellow',
	'teal',
	'violet',
	'grey',
	'black',
	
	'yellow-a',
	'yellow-b',
	
] as const;
export type IconColor = (typeof colors)[number];

export const icons = Object.fromEntries(colors.map(color => [color, {
	single: new L.Icon({
		iconUrl: `${img}${color}.png`,
		shadowUrl: img + 'marker-shadow.png',
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
	}),
	multi: new L.Icon({
		iconUrl: `${img}${color}.multi.png`,
		shadowUrl: img + 'marker-shadow.png',
		iconSize: [35, 46],
		iconAnchor: [17, 51],
		popupAnchor: [1, -34],
		shadowSize: [46, 46],
	}),
}])) as Record<IconColor, {
	single: L.Icon;
	multi: L.Icon;
}>;

export const locationIcon = new L.Icon({
	iconUrl: `${img}circle.png`,
	// shadowUrl: img + 'marker-shadow.png',
	iconSize: [25, 25],
	iconAnchor: [12, 12],
	popupAnchor: [0, 0],
	// shadowSize: [41, 41],
});

