export type None = undefined | null;
export type Maybe<T> = T | None;
export type Some<T> = NonNullable<T>;

/**
 * Checks whether value is an element of the list and asserts that the value is of the element-type for that list.
 * E.g. if (isIn(value, ['a', 'b'] as const)) then value: 'a' | 'b'
 */
export function isIn<V, T extends readonly (V | string | number)[]>(value: V, list: T): value is V & T[number] {
	return list.includes(value);
}

type MaybeCB<A, B> = (it: Some<A>) => B;

export function isNone(it: any): it is None {
	return it === null || it === undefined;
}

export function isSome<T>(it: T): it is Some<T> {
	return it !== null && it !== undefined;
}

export function maybe<IT, RT>(it: IT, action: MaybeCB<IT, RT>): RT | Extract<IT, null | undefined> {
	if (!isSome(it)) return it as Extract<IT, null | undefined>;
	return action(it);
}

export function pick<T, K extends keyof T>(obj: T, ...keys: readonly (K | readonly K[])[]): Pick<T, K> {
	const out: any = {};
	for (const k of keys.flat(1) as K[]) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
	return out;
}

export function omit<T, K extends keyof T>(obj: T, ...keys: readonly (K | readonly K[])[]): Omit<T, K> {
	const out: any = {};
	const flat = keys.flat(1);
	for (const k in obj) if (!flat.includes(k as any)) out[k] = obj[k];
	return out;
}

