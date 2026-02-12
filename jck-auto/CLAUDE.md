# JCK AUTO Website

## О проекте
Сайт компании JCK AUTO — импорт автомобилей из Китая, Кореи и Японии.
Светлая чистая тема, premium feel, mobile-first. Акценты: тёмно-синий + золото.

## Стандарты
- TypeScript strict для всех файлов
- Только Tailwind CSS (без inline-стилей)
- Компоненты в PascalCase
- Все страницы мобильно-адаптивные
- Framer Motion для анимаций (scroll-triggered)
- Минимум зависимостей, максимум производительности

## Цветовая палитра (Tailwind custom colors)
- background: #FFFFFF
- surface: #F8F9FA
- surface-alt: #F1F3F5
- border: #E5E7EB
- primary (тёмно-синий): #1E3A5F
- primary-hover: #2A4A73
- secondary (золото): #C9A84C
- secondary-hover: #D4B85A
- text: #111827
- text-muted: #6B7280
- china: #DE2910
- korea: #003478
- japan: #BC002D

## Структура
/src/app/ — страницы (App Router)
/src/components/layout/ — Header, Footer, MobileMenu
/src/components/sections/ — секции главной страницы
/src/components/ui/ — shadcn/ui компоненты
/src/lib/ — утилиты, калькулятор, константы
/src/data/ — статические данные (команда, отзывы, FAQ)

## Команды
npm run dev — dev server
npm run build — production build
npm run lint — проверка кода
