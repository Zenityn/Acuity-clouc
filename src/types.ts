export interface Stock {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  robloxPrice?: number;
  isForSale?: boolean;
  changePercent: number;
  sector: string;
}

export interface Holding {
  stockId: string;
  shares: number;
  avgBuyPrice: number;
}

export interface UserStats {
  balance: number;
  username: string;
}
