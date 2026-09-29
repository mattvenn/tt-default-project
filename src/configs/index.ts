// SPDX-License-Identifier: Apache-2.0

import shiftReg from './1_shift_reg.ini?raw';
import configB from './config_b.ini?raw';
import configC from './config_c.ini?raw';

export interface IBoardConfig {
  id: string;
  name: string;
  description: string;
  content: string;
}

// TODO: configs B and C are placeholders until the real ones are supplied.
export const configs: IBoardConfig[] = [
  {
    id: 'shift_reg',
    name: '1 - shift register',
    description: 'wokwi_shift_register_801 (ttsky25b #266), 3 Hz clock, manual inputs',
    content: shiftReg,
  },
  { id: 'b', name: 'Config B', description: 'Loads tt_um_loopback by default', content: configB },
  { id: 'c', name: 'Config C', description: 'Loads tt_um_vga_clock by default', content: configC },
];
