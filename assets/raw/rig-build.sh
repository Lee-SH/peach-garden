#!/bin/bash
# Rebuild every style-B rig from its parts sheet (assets/raw/<id>-partsB.png). Run from the repo root.
# The --order lists say which drawing on each sheet is which part (see tools/rig-auto.mjs).
set -e
D=head,torso,skirt,upper,fore,weapon,thigh,shin,ref
W4=head,torso,skirt,weapon,upper,fore,thigh,shin,ref
b() { node tools/rig-auto.mjs assets/raw/$1-partsB.png "$@" 2>&1 | grep -v "hole removed" | cut -c1-70; }
b liubei twin
b guanyu polearm --neck 0.5 --head 1.15
b zhangfei polearm --order head,torso,skirt,upper,fore,skip,thigh,shin,weapon,ref
E="--head 1.1"
b rebel_farmer polearm --order $D $E
b rebel_bandit single --order head,torso,skirt,upper,fore,skip,skip,weapon,ref,thigh,shin,skip $E
b rebel_elite single --order $D $E
b archer_hunter single --order $D $E
b archer_xbow single --order $D $E
b sorc_talisman single --order head,torso,skirt,weapon,upper,fore,thigh,shin,skip,ref $E
b sorc_fire polearm --order $D --neck 0.55 $E
b brute_farmhand single --order $W4 $E
b brute_iron polearm --order $D --wlen 350 --grip 0.8 $E
b dengmao polearm --order $D --wlen 400 $E
b chengyuanzhi single --order head,torso,skirt,upper,fore,thigh,weapon,ref,shin $E
b chieftain twin --order head,skip,skip,skip,torso,skirt,upper,skip,fore,skip,skip,thigh,shin,skip,weapon $E
b zhangliang polearm --order head,torso,skirt,upper,fore,weapon,thigh,shin $E
b gaosheng twin --order $D $E
b zhangbao single --order $D --neck 0.7 $E
b zhangjue polearm --order $W4 --neck 0.6 $E
