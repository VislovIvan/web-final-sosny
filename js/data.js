// Общие данные базы «Сосны»: одни ID домов для всех страниц.
// x и y: центр дома на схеме в процентах. busy: демо-занятость, offset в днях от сегодня.

export const HOUSES = [
  {
    id: 'h1',
    name: 'Шишка',
    description: 'Маленький дом для двоих на опушке: печка, плед и окно в лес.',
    capacity: 2,
    price: 4000,
    x: 12,
    y: 44,
    features: ['Печка', 'Вид на лес'],
    busy: [{ offset: 5, nights: 3 }],
  },
  {
    id: 'h2',
    name: 'Брусника',
    description: 'Уютный дом для небольшой семьи с террасой и мангалом.',
    capacity: 3,
    price: 5500,
    x: 28,
    y: 42,
    features: ['Терраса', 'Мангал'],
    busy: [{ offset: -1, nights: 4 }],
  },
  {
    id: 'h3',
    name: 'У причала',
    description: 'Ближе всех к воде: пара шагов до причала, лодка в аренду.',
    capacity: 4,
    price: 9000,
    x: 46,
    y: 41,
    features: ['Вид на озеро', 'Лодка', 'Терраса'],
    busy: [{ offset: 10, nights: 3 }],
  },
  {
    id: 'h4',
    name: 'Ладога',
    description: 'Панорамные окна на озеро, большая кухня-гостиная и камин.',
    capacity: 6,
    price: 12000,
    x: 74,
    y: 40,
    features: ['Вид на озеро', 'Камин', 'Кухня-гостиная'],
    busy: [{ offset: 2, nights: 3 }],
  },
  {
    id: 'h5',
    name: 'Маяк',
    description: 'Двухэтажный дом с мансардой и видом на закат над Ладогой.',
    capacity: 5,
    price: 10500,
    x: 91,
    y: 38,
    features: ['Мансарда', 'Вид на озеро'],
    busy: [{ offset: 7, nights: 7 }],
  },
  {
    id: 'h6',
    name: 'Черника',
    description: 'Тихий домик в глубине участка, рядом лесная тропа.',
    capacity: 2,
    price: 4500,
    x: 12,
    y: 76,
    features: ['Печка', 'Лесная тропа'],
    busy: [{ offset: 0, nights: 2 }, { offset: 14, nights: 2 }],
  },
  {
    id: 'h7',
    name: 'Лесной',
    description: 'Дом среди сосен с верандой и гамаком.',
    capacity: 4,
    price: 7500,
    x: 30,
    y: 74,
    features: ['Веранда', 'Гамак'],
    busy: [{ offset: 3, nights: 4 }],
  },
  {
    id: 'h8',
    name: 'Сосновый',
    description: 'Просторный дом для компании: три спальни и своя баня.',
    capacity: 6,
    price: 11000,
    x: 50,
    y: 73,
    features: ['Баня', 'Три спальни'],
    busy: [{ offset: 1, nights: 6 }],
  },
  {
    id: 'h9',
    name: 'Скворечник',
    description: 'Домик на сваях с видом на верхушки сосен.',
    capacity: 3,
    price: 6000,
    x: 69,
    y: 75,
    features: ['Веранда', 'Вид на лес'],
    busy: [{ offset: 6, nights: 2 }],
  },
  {
    id: 'h10',
    name: 'Большой',
    description: 'Самый большой дом базы: четыре спальни, баня и кострище.',
    capacity: 8,
    price: 15000,
    x: 88,
    y: 72,
    features: ['Баня', 'Кострище', 'Четыре спальни'],
    busy: [{ offset: 0, nights: 1 }, { offset: 4, nights: 3 }],
  },
];

export const MAX_GUESTS = Math.max(...HOUSES.map((house) => house.capacity));

export function getHouse(id) {
  return HOUSES.find((house) => house.id === id) ?? null;
}

export function houseNumber(house) {
  return house.id.slice(1);
}
