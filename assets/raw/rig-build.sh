#!/bin/bash
# Rebuild every cutout rig from its parts sheet (assets/raw/<id>-partsC.png). Run from the repo root.
# The sheets were drawn by Gemini from each character's painted idle picture (roughly a 3×3 sheet:
# head torso skirt / upper fore weapon / thigh shin ref), so --natural keeps the drawn proportions.
# --neck: where the chin is on head images with long beards.
set -e
b() { node tools/rig-auto.mjs assets/raw/$1-partsC.png "$@" --natural --shapes 2>&1 | grep -v "hole removed\|natural scale\|^  \|^}" | cut -c1-90; }
b liubei twin
b guanyu polearm --neck 0.5
b zhangfei polearm
b rebel_farmer polearm
b rebel_bandit single
b rebel_elite single
b archer_hunter single
b archer_xbow single
b sorc_talisman single
b sorc_fire polearm --neck 0.55
b brute_farmhand single
b brute_iron polearm
b dengmao polearm
b chengyuanzhi single
b chieftain twin
b zhangliang polearm
b gaosheng twin
b zhangbao single --neck 0.7
b zhangjue polearm --neck 0.6
