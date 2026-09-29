// SPDX-License-Identifier: Apache-2.0

import shiftReg from './1_shift_reg.ini?raw';
import bcd from './2_bcd.ini?raw';
import sums from './3_sums.ini?raw';

export interface IBoardConfig {
  id: string;
  name: string;
  description: string;
  content: string;
}

export const configs: IBoardConfig[] = [
  {
    id: 'shift_reg',
    name: '1 - shift register',
    description: 'wokwi_shift_register_801 (ttsky25b #266), 3 Hz clock, manual inputs',
    content: shiftReg,
  },
  {
    id: 'bcd',
    name: '2 - binary to decimal',
    description:
      'wokwi_tiny_tapeout_project_binary_to_decimal_display_265 (ttsky25b #166), manual inputs',
    content: bcd,
  },
  {
    id: 'sums',
    name: '3 - single digit sums',
    description: 'wokwi_single_digit_sums_by_mark_angelov_697 (ttsky25b #42), manual inputs',
    content: sums,
  },
];
