const ruUk = {

	'нужна вода и еда': null,
	'требуется эвакуация': null,
	'медицина, требуются лекарства': null,
	актуально: null,
	'была эвакуация, нет актуального статуса': null,
	'нет данных об эвакуации': null,
	'решили остаться, запроса нет': null,
	вывезли: null,
	погибшие: null,
	животные: null,
	
	// disregard
	дубль: null,
	приплюсовали: null,
	'пустая строка': null,
	
	Эвакуированы: null,
	Пропавшие: null,
	
	Фильтры: null,
	Выделить: null,
	сбросить: null,
	Список: null,
	
	'показать только': null,
	'показать также': null,
	фильтры: null,
	
	'Ничего не выбрано': null,
	'Не нашлось': null,
	'Нет координат': null,
	
	точек: null,
	Людей: null,
	Животных: null,
	Адрес: null,
	Координаты: null,
	Телефон: null,
	'Контактная информация': null,
	Детали: null,
	
	Визиком: null,
	
} as const;

export type TranslationId = keyof typeof ruUk;

export const languageConfig: {
	language: 'ru' | 'uk';
} = { language: 'ru' }; // for now

export function t(id: TranslationId) {
	return languageConfig.language == 'uk' ? ruUk[id] ?? id : id;
}
