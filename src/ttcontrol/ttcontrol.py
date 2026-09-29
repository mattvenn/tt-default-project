# SPDX-License-Identifier: Apache-2.0
# Copyright (C) 2024-2026, Tiny Tapeout LTD

import os
import sys


def report(dict_or_key: dict, val: str = None):
    if val is not None and not isinstance(dict_or_key, dict):
        dict_or_key = {dict_or_key: val}

    strs = list(map(lambda x: f"{x[0]}={x[1]}", dict_or_key.items()))
    print("\n".join(strs))


print()
report("sys.version", sys.version.split(";")[1].strip())
try: # SDK 3.x
    with open("VERSION", "r") as f:
        for line in f:
            if '=' in line:
                print(f'tt.sdk_{line.strip()}')
except:
    try: # SDK 2.x
        sdk_version = next(filter(lambda f: f.startswith("release_v"), os.listdir("/")))
    except:
        sdk_version = "unknown"
    report("tt.sdk_version", sdk_version)


def read_rom():
    from ttboard.demoboard import DemoBoard

    tt = DemoBoard.get()
    shuttle = tt.chip_ROM.shuttle
    if shuttle is None or not len(shuttle):
        shuttle = "unknown"

    if hasattr(tt.chip_ROM, "contents"):
        report(tt.chip_ROM.contents)
    else:
        report({"shuttle": shuttle, "repo": "SHUTTLE OVERRIDE"})
