export type AssetItem = {
  id: string;
  name: string;
  amount: number;
};

export type AssetCategory = {
  id: string;
  title: string;
  description: string;
  colorClass: string;
  bgClass: string;
  updatedAt: string;
  items: AssetItem[];
};

export type LiabilityItem = {
  id: string;
  name: string;
  description: string;
  amount: number;
  updatedAt: string;
  icon: 'building' | 'creditCard';
};
