export type ShopCategory = 'Протеин' | 'Креатин и амино' | 'Витамины' | 'Батончики' | 'Напитки' | 'Аксессуары' | 'Одежда';

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: ShopCategory;
  price: number;
  oldPrice?: number;
  unit?: string;
  image: string;
  rating: number;
  reviews: number;
  description: string;
  options?: { label: 'Вкус' | 'Размер' | 'Цвет'; values: string[] };
  badge?: 'Хит' | 'Новинка' | 'Скидка';
  nutrition?: { serving: string; protein: number; carbs: number; fat: number; calories: number };
  inStock: boolean;
  barcode?: string; // EAN/UPC printed on the package, read by the register's scanner
};

export const shopCategories: { key: 'Все' | ShopCategory; icon: string }[] = [
  { key: 'Все', icon: 'grid-outline' },
  { key: 'Протеин', icon: 'nutrition-outline' },
  { key: 'Креатин и амино', icon: 'flask-outline' },
  { key: 'Витамины', icon: 'medkit-outline' },
  { key: 'Батончики', icon: 'fast-food-outline' },
  { key: 'Напитки', icon: 'water-outline' },
  { key: 'Аксессуары', icon: 'barbell-outline' },
  { key: 'Одежда', icon: 'shirt-outline' },
];


export const products: Product[] = [
  {
    id: 's1',
    name: 'Вода 1 л',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's2',
    name: 'Вода 0,5 л',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's3',
    name: 'Дизи',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's4',
    name: 'Витамин C',
    brand: '',
    category: 'Витамины',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's5',
    name: 'Витамин C в стекле',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's6',
    name: 'Кола Зеро в стекле',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's7',
    name: 'Кола Зеро 0,5 л',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's8',
    name: 'Зет',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's9',
    name: 'Протеин Whey',
    brand: '',
    category: 'Протеин',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's10',
    name: 'Энергетик Curse',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's11',
    name: 'L-карнитин',
    brand: '',
    category: 'Креатин и амино',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's12',
    name: 'Lipo 6',
    brand: '',
    category: 'Креатин и амино',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's13',
    name: 'Гейнер',
    brand: '',
    category: 'Протеин',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's14',
    name: 'Батончик',
    brand: '',
    category: 'Батончики',
    price: 500, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's15',
    name: 'Батончик большой',
    brand: '',
    category: 'Батончики',
    price: 800, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's16',
    name: 'Red Bull классика, маленький',
    brand: '',
    category: 'Напитки',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's17',
    name: 'BCAA',
    brand: '',
    category: 'Креатин и амино',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's18',
    name: 'Креатин моногидрат',
    brand: '',
    category: 'Креатин и амино',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
  {
    id: 's19',
    name: 'Креатин Creakong',
    brand: '',
    category: 'Креатин и амино',
    price: 0, // 0 = not set yet, edit in the staff Products tab
    image: '',
    rating: 0,
    reviews: 0,
    description: '',
    inStock: true,
  },
];

export function productById(id: string) {
  return products.find((p) => p.id === id);
}

export const MEMBER_DISCOUNT = 0.1;
export const PROMO_CODES: Record<string, number> = { GYM10: 0.1, START15: 0.15 };
