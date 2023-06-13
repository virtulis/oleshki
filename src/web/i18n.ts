const ruUk = {

	'нужна вода и еда': 'потрібні вода та їжа',
	'требуется эвакуация': 'потрібна евакуація',
	'медицина, требуются лекарства': 'медицина, потрібні ліки',
	актуально: 'актуально',
	'была эвакуация, нет актуального статуса': 'була евакуація, немає актуального статусу',
	'нет данных об эвакуации': 'немає даних про евакуацію',
	'решили остаться, запроса нет': 'вирішили залишитися, запиту немає',
	вывезли: 'вивезли',
	погибшие: 'загиблі',
	животные: 'тварини',
	
	// disregard
	дубль: null,
	приплюсовали: null,
	'пустая строка': null,
	
	Эвакуированы: 'Евакуйовані',
	Пропавшие: 'Зниклі',
	
	Фильтры: 'Фільтри',
	Выделить: 'Виділити',
	сбросить: 'скинути',
	Список: 'Список',
	
	'показать только': 'показати лише',
	'показать также': 'показати також',
	фильтры: 'фільтри',
	
	'Ничего не выбрано': 'Нічого не вибрано',
	'Не нашлось': 'Не знайдено',
	'Нет координат': 'Немає координат',
	
	точек: 'точок',
	Людей: 'Людей',
	Животных: 'Тварин',
	Адрес: 'Адреса',
	Координаты: 'Координати',
	Телефон: 'Телефон',
	'Контактная информация': 'Контактна інформація',
	Детали: 'Подробиці',
	
	Визиком: 'Візіком',
	
} as const;

export type TranslationId = keyof typeof ruUk;

export const languageConfig: {
	language: 'ru' | 'uk';
} = { language: 'ru' }; // for now

export function t(id: TranslationId) {
	return languageConfig.language == 'uk' ? ruUk[id] ?? id : id;
}
