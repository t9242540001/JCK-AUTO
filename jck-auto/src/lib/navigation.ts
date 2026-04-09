/**
 * @file navigation.ts
 * @description Единый конфиг навигации сайта. Используется в Header, Footer, MobileMenu.
 * @rule НЕ дублировать NAV_ITEMS в компонентах — только импорт из этого файла
 * @lastModified 2026-04-02
 */

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Главная', href: '/' },
  {
    label: 'Каталог',
    href: '/catalog',
    children: [
      { label: 'Автомобили', href: '/catalog' },
      { label: 'Ноускаты', href: '/catalog/noscut' },
    ],
  },
  {
    label: 'Сервисы',
    href: '/tools',
    children: [
      { label: 'Калькулятор «под ключ»', href: '/tools/calculator' },
      { label: 'Калькулятор пошлин', href: '/tools/customs' },
      { label: 'Аукционные листы', href: '/tools/auction-sheet' },
      { label: 'Анализатор Encar', href: '/tools/encar' },
    ],
  },
  { label: 'О компании', href: '/about' },
  { label: 'Блог', href: '/blog' },
  { label: 'Новости', href: '/news' },
];
