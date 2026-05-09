import { Stock } from './types';

export const INITIAL_STOCKS: Stock[] = [
  {
    id: '1',
    symbol: 'BLOXY',
    name: 'Bloxy Cola Corp.',
    currentPrice: 425.50,
    changePercent: 5.2,
    sector: 'Consumer Goods'
  },
  {
    id: '2',
    symbol: 'PIZZA',
    name: 'Pizza Planet Inc.',
    currentPrice: 890.20,
    changePercent: -1.5,
    sector: 'Food & Beverage'
  },
  {
    id: '3',
    symbol: 'ROCORP',
    name: 'Robloxian Corp.',
    currentPrice: 12500.00,
    changePercent: 12.4,
    sector: 'Technology'
  },
  {
    id: '4',
    symbol: 'MINE',
    name: 'Blocky Mining Ltd.',
    currentPrice: 75.25,
    changePercent: 0.8,
    sector: 'Materials'
  },
  {
    id: '5',
    symbol: 'GEAR',
    name: 'Avatar Custom Gear',
    currentPrice: 2100.00,
    changePercent: -3.2,
    sector: 'Fashion'
  },
  {
    id: '6',
    symbol: 'DEVX',
    name: 'Developer Exchange',
    currentPrice: 1000.00,
    changePercent: 0.0,
    sector: 'Finance'
  }
];
