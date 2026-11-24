import apkMobileShowcaseImg from '../assets/images/apk_mobile_showcase_1794580278328.jpg';
import featureEnergyGridImg from '../assets/images/feature_energy_grid_1794580278797.jpg';
import featureGlobalTradeImg from '../assets/images/feature_global_trade_1794580278110.jpg';
import featureQuantumLabImg from '../assets/images/feature_quantum_lab_1794580278591.jpg';
import heroLeadSummitImg from '../assets/images/hero_lead_summit_1794580277832.jpg';
import type { ImageKey } from './newsData';

export const EDITORIAL_IMAGES: Record<ImageKey, string> = {
  hero_lead_summit: heroLeadSummitImg,
  feature_global_trade: featureGlobalTradeImg,
  feature_energy_grid: featureEnergyGridImg,
  feature_quantum_lab: featureQuantumLabImg,
  apk_mobile_showcase: apkMobileShowcaseImg
};
