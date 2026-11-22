import sqlite3
import json

conn = sqlite3.connect('myarea24-frontend/myarea24.db')
c = conn.cursor()

c.execute('''
    SELECT id, commodity, variety, mandi_name, state, district, category,
           modal_price, min_price, max_price, unit, price_trend, observed_date,
           raw_modal_price, raw_min_price, raw_max_price, raw_unit, grade,
           source_name, reported_at
    FROM mandi_prices
    ORDER BY state, district, commodity
''')
rows = c.fetchall()

items = []
for r in rows:
    id_val, comm, var, mandi, state, dist, cat, modal, min_p, max_p, unit, trend, obs_date, raw_modal, raw_min, raw_max, raw_unit, grade, src, rep_at = r
    raw_min_f = float(raw_min or (min_p or modal or 0) * 100.0)
    raw_max_f = float(raw_max or (max_p or modal or 0) * 100.0)
    raw_modal_f = float(raw_modal or (modal or 0) * 100.0)
    modal_kg = float(modal or round(raw_modal_f / 100.0, 2))
    min_kg = float(min_p or round(raw_min_f / 100.0, 2))
    max_kg = float(max_p or round(raw_max_f / 100.0, 2))

    items.append({
        'id': id_val,
        'state': state or 'NCT of Delhi',
        'district': dist or '',
        'mandi_name': mandi or 'APMC Mandi',
        'commodity': comm,
        'variety': var or 'Standard',
        'grade': grade or 'FAQ',
        'category': cat or 'Vegetables',
        'min_price': min_kg,
        'max_price': max_kg,
        'modal_price': modal_kg,
        'unit': unit or 'kg',
        'raw_min_price': raw_min_f,
        'raw_max_price': raw_max_f,
        'raw_modal_price': raw_modal_f,
        'raw_unit': raw_unit or 'Quintal',
        'wholesale_display': f'₹{int(raw_modal_f):,} / Quintal',
        'retail_normalized_display': f'₹{modal_kg:.2f} / kg',
        'reporting_date': str(rep_at or '13/11/2026'),
        'source_name': src or 'Government of India - Agmarknet (data.gov.in)',
        'price_trend': trend or 'Stable'
    })

c.execute('SELECT DISTINCT state FROM mandi_prices WHERE state IS NOT NULL ORDER BY state')
states = [row[0] for row in c.fetchall()]

state_districts = {}
for s in states:
    c.execute('SELECT DISTINCT district FROM mandi_prices WHERE state = ? AND district IS NOT NULL AND district != "" ORDER BY district', (s,))
    state_districts[s] = [row[0] for row in c.fetchall()]

output = {
    'states': states,
    'state_districts': state_districts,
    'items': items,
    'total': len(items)
}

with open('myarea24-frontend/src/data/mandiSeedData.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f'Successfully exported {len(items)} mandi records across {len(states)} states to src/data/mandiSeedData.json')
conn.close()
