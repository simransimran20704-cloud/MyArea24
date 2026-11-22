"""
MyArea24 — Indian Grocery, Medicine & FMCG Phonetic Synonym Engine
Provides bidirectional Hinglish, regional, and phonetic expansions for hyperlocal search.
Enables instant typo tolerance and local semantic discovery across Indian retail categories.
"""

import re
from typing import Any, List, Set, Dict, Optional
from sqlalchemy import or_, func

# Canonical synonym clusters across high-frequency Indian neighborhood commerce items.
# List ordering represents strict priority: primary english/hinglish terms first, followed by brands and variants.
INDIAN_SYNONYM_CLUSTERS: List[Dict[str, Any]] = [
    # 1. Dairy & Fresh Morning Staples
    {
        "category": "Grocery",
        "subcategory": "Dairy",
        "keywords": [
            "milk", "doodh", "dudh", "amul", "dairy", "mother dairy", "paneer", "panir",
            "curd", "dahi", "butter", "makhan", "ghee", "desi ghee", "dood",
            "chaas", "buttermilk", "lassi",
        ],
    },
    # 2. Flour, Grains & Staples
    {
        "category": "Grocery",
        "subcategory": "Atta & Flours",
        "keywords": [
            "atta", "aata", "flour", "wheat", "gehun", "aashirvaad", "gehu",
            "maida", "suji", "sooji", "semolina", "besan", "gram flour",
            "makki", "chokar", "daliya",
        ],
    },
    # 3. Rice & Poha
    {
        "category": "Grocery",
        "subcategory": "Rice & Grains",
        "keywords": [
            "rice", "chawal", "chaawal", "basmati", "poha", "biryani rice",
            "daawat", "india gate", "brown rice", "kolam", "sona masoori",
        ],
    },
    # 4. Sugar, Jaggery & Sweeteners
    {
        "category": "Grocery",
        "subcategory": "Sugar & Jaggery",
        "keywords": [
            "sugar", "cheeni", "chini", "shakkar", "gur", "gud", "jaggery",
            "bura", "khand", "sugar free", "madhu", "honey",
        ],
    },
    # 5. Edible Oils & Ghee
    {
        "category": "Grocery",
        "subcategory": "Oils & Ghee",
        "keywords": [
            "oil", "tel", "mustard oil", "sarson", "sarson tel", "fortune", "refined",
            "refined oil", "dhara", "sunflower oil", "soya oil", "til tel", "sesame", "olive oil", "tail",
        ],
    },
    # 6. Tea, Coffee & Beverages
    {
        "category": "Grocery",
        "subcategory": "Tea & Coffee",
        "keywords": [
            "tea", "chai", "chaai", "tea patti", "patti", "tata tea",
            "red label", "taj mahal", "wagh bakri", "coffee", "koffee",
            "nescafe", "bru", "green tea",
        ],
    },
    # 7. Pulses & Lentils (Dals)
    {
        "category": "Grocery",
        "subcategory": "Pulses & Dals",
        "keywords": [
            "dal", "daal", "pulses", "moong", "moong dal", "arhar", "toor",
            "toor dal", "urad", "urad dal", "chana", "chana dal", "rajma",
            "chhole", "chole", "kabuli chana", "masoor", "malka",
        ],
    },
    # 8. Salt & Everyday Spices (Masala)
    {
        "category": "Grocery",
        "subcategory": "Spices & Masala",
        "keywords": [
            "salt", "namak", "tata salt", "sendha namak", "rock salt", "black salt",
            "kala namak", "turmeric", "haldi", "chilli", "mirch", "lal mirch",
            "coriander", "dhaniya", "cumin", "jeera", "garam masala", "hing",
            "asafetida", "elaichi", "cardamom", "laung", "clove", "dalchini",
            "black pepper", "kali mirch",
        ],
    },
    # 9. Fresh Vegetables & Daily Produce
    {
        "category": "Grocery",
        "subcategory": "Vegetables",
        "keywords": [
            "vegetable", "vegetables", "sabzi", "sabji", "potato", "aloo",
            "aalu", "onion", "pyaaz", "pyaz", "tomato", "tamatar",
            "ginger", "adrak", "garlic", "lehsun", "lahsun", "chilli", "mirchi",
            "hari mirch", "lemon", "nimbu", "coriander leaves", "hara dhaniya",
        ],
    },
    # 10. Pharmacy & Over-The-Counter Medicines (OTC)
    {
        "category": "Pharmacy",
        "subcategory": "OTC Medicine",
        "keywords": [
            "medicine", "medicines", "dawa", "dawai", "pharmacy", "chemist", "medical",
            "paracetamol", "dolo", "dolo 650", "crocin", "calpol", "tablet", "tablets",
            "capsule", "syrup", "fever", "headache", "sar dard", "bukhar", "cough",
            "cough syrup", "khansi", "combiflam", "vicks", "inhaler", "iodex", "moov",
            "volini", "painkiller", "bandaid", "bandage", "dettol", "detol", "savlon",
            "betadine", "ors", "electral", "digene", "eno", "gelusil", "acidity", "gas",
            "davai", "goli", "paracitamol",
        ],
    },
    # 11. Personal Care, Cleaning & Detergents
    {
        "category": "Grocery",
        "subcategory": "Personal & Home Care",
        "keywords": [
            "soap", "sabun", "shampoo", "shampu", "toothpaste", "paste",
            "colgate", "pepsodent", "sensodyne", "toothbrush", "brush",
            "detergent", "surf", "surf excel", "ariel", "tide", "rin",
            "vim", "dishwash", "harpic", "lizol", "cleaner", "agarbatti",
        ],
    },
    # 12. Indian Sweets & Snacks (Mithai / Halwai)
    {
        "category": "Food & Dining",
        "subcategory": "Sweets & Bakery",
        "keywords": [
            "sweets", "mithai", "halwai", "ladoo", "laddu", "rasgulla",
            "gulab jamun", "barfi", "kaju katli", "jalebi", "samosa",
            "kachori", "namkeen", "bhujia", "haldiram", "bikano",
            "bakery", "bread", "pav", "biscuit", "biscut", "rusk", "cake",
        ],
    },
    # 13. Mobile, Accessories & Electronics
    {
        "category": "Electronics",
        "subcategory": "Mobile & Accessories",
        "keywords": [
            "phone", "mobile", "smartphone", "charger", "fast charger",
            "cable", "type c", "usb cable", "earphone", "earphones", "headphone",
            "airpods", "tws", "powerbank", "cover", "screen guard", "tempered glass",
            "battery", "adapter", "fone",
        ],
    },
    # 14. Local Home Services
    {
        "category": "Services",
        "subcategory": "Home Maintenance",
        "keywords": [
            "electrician", "bijli", "bijliwala", "wiring", "fan repair", "ac repair",
            "plumber", "plumberwala", "nal", "leakage", "carpenter", "mistri",
            "painter", "salon", "saloon", "parlour", "haircut", "facial",
        ],
    },
]


def expand_search_query(q: str, max_terms: int = 15) -> List[str]:
    """
    Expands a user search query into a prioritized list of Hinglish, English,
    and phonetic synonyms. Preserves original query words as top priority.
    """
    if not q or not q.strip():
        return []

    cleaned = re.sub(r"[^\w\s]", " ", q.strip().lower())
    tokens = [t for t in cleaned.split() if len(t) >= 2]
    if not tokens:
        return [q.strip().lower()]

    expanded: List[str] = []
    seen: Set[str] = set()

    # 1. Full original query and tokens have first priority
    full_q = q.strip().lower()
    expanded.append(full_q)
    seen.add(full_q)

    for tok in tokens:
        if tok not in seen:
            expanded.append(tok)
            seen.add(tok)

    # 2. Match against clusters
    matched_clusters: List[Dict[str, Any]] = []
    for cluster in INDIAN_SYNONYM_CLUSTERS:
        cluster_keys = set(cluster["keywords"])
        # Check if full query or any token hits the cluster
        if full_q in cluster_keys or any(t in cluster_keys for t in tokens):
            matched_clusters.append(cluster)
        else:
            # Substring match (e.g. 'dolo' in 'dolo 650' or 'paracit' in 'paracetamol')
            for k in cluster["keywords"]:
                if any(len(t) >= 3 and (t in k or k in t) for t in tokens):
                    matched_clusters.append(cluster)
                    break

    # 3. Add synonyms from matched clusters in prioritized order
    for cluster in matched_clusters:
        for syn in cluster["keywords"]:
            if syn not in seen and len(expanded) < max_terms:
                expanded.append(syn)
                seen.add(syn)

    return expanded


def get_implied_categories_for_query(q: str) -> List[str]:
    """
    Identifies high-confidence business / product categories implied by a search term.
    E.g., 'dawai' -> ['Pharmacy'], 'tamatar' -> ['Grocery'], 'mithai' -> ['Food & Dining'].
    """
    if not q or not q.strip():
        return []

    cleaned = q.strip().lower()
    categories: Set[str] = set()

    for cluster in INDIAN_SYNONYM_CLUSTERS:
        cluster_keys = set(cluster["keywords"])
        if cleaned in cluster_keys:
            categories.add(cluster["category"])
        else:
            for k in cluster["keywords"]:
                if k in cleaned or (len(cleaned) >= 3 and cleaned in k):
                    categories.add(cluster["category"])
                    break

    return list(categories)


def build_fuzzy_text_search_filters(
    column,
    expanded_terms: List[str],
    is_postgres: bool = False,
    similarity_threshold: float = 0.25,
):
    """
    Builds SQL filter clauses for text matching:
    - On PostgreSQL: combines trigram similarity (pg_trgm) with ILIKE.
    - On SQLite: multi-term case-insensitive pattern matching.
    """
    clauses = []
    for term in expanded_terms:
        clean_t = term.strip()
        if not clean_t:
            continue
        
        # Standard substring matching
        pattern = f"%{clean_t.lower()}%"
        clauses.append(func.lower(column).like(pattern))

        # On PostgreSQL with pg_trgm extension enabled:
        if is_postgres and len(clean_t) >= 3:
            # Trigram similarity check
            clauses.append(func.similarity(column, clean_t) >= similarity_threshold)

    return or_(*clauses) if clauses else None
