import sys
with open('client/src/pages/RoyalPetClinicApp.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()
content = content.replace('\ufffd', '')
with open('client/src/pages/RoyalPetClinicApp.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed: removed all replacement characters from RoyalPetClinicApp.jsx')