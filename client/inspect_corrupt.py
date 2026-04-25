from collections import Counter
import re
path='src/pages/RoyalPetClinicApp.jsx'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    data=f.read()
patterns=Counter()
for m in re.finditer(r'.{0,8}\ufffd.{0,8}', data):
    patterns[m.group()] += 1
for p,c in patterns.most_common(100):
    print(c, repr(p))
