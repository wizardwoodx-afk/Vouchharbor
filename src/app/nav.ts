/**
 * Shared navigation metadata.
 *
 * Patina (17.1) — five docks, one helm. Both App.tsx and the sidebar render
 * from this map; nothing hardcodes the list twice. Probe (navAlign) pins this.
 */
import type { ViewKey } from '../App';

export interface NavItem {
  key: ViewKey;
  label: string;
  description: string;
}

export const NAV: NavItem[] = [
  { key: 'agents', label: 'Agents', description: 'Generalist & MoE' },
  { key: 'harbor',   label: 'Harbor',        description: 'Live voyages' },
  { key: 'ship',     label: 'Ship',          description: 'Vessel & crew' },
  { key: 'chart',    label: 'Chart',         description: 'Plot course' },
  { key: 'register', label: 'Register',      description: 'Manifests & receipts' },
  { key: 'master',   label: 'Harbor Master', description: 'Governance desk' },
];

export function navFor(k: ViewKey): NavItem | undefined {
  return NAV.find(n => n.key === k);
}
