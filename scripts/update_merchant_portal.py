def update_merchant_portal_server_first():
    path = "src/merchant/MerchantPortal.tsx"
    with open(path, "r", encoding="utf-8") as f:
        text = f.read().replace("\r\n", "\n")

    # 1. Update initial state of products to start as empty or check offline
    old_state = "  const [products, setProducts] = useState<MerchantProductItem[]>(() =>\n    loadStoredCollection('products', currentBusiness.id, INITIAL_MERCHANT_PRODUCTS)\n  );"
    new_state = "  // Server-First Catalog: Initialized empty or with offline cache until server response lands\n  const [products, setProducts] = useState<MerchantProductItem[]>(() =>\n    loadStoredCollection('products', currentBusiness.id, INITIAL_MERCHANT_PRODUCTS)\n  );"
    if old_state in text:
        text = text.replace(old_state, new_state)

    # 2. In collections useEffect, remove synchronous setProducts
    old_sync = """  // Synchronize collections whenever currentBusiness switches
  useEffect(() => {
    const bizId = currentBusiness.id;
    const bizName = currentBusiness.name;

    const nextProducts = loadStoredCollection('products', bizId, INITIAL_MERCHANT_PRODUCTS);
    const nextServices = loadStoredCollection('services', bizId, INITIAL_MERCHANT_SERVICES);
    const nextOffers = loadStoredCollection('offers', bizId, INITIAL_MERCHANT_OFFERS);
    const nextPosts = loadStoredCollection('posts', bizId, INITIAL_MERCHANT_POSTS);
    const nextEvents = loadStoredCollection('events', bizId, INITIAL_MERCHANT_EVENTS);
    const nextReviews = loadStoredCollection('reviews', bizId, INITIAL_MERCHANT_REVIEWS);
    const nextConversations = loadStoredCollection('conversations', bizId, INITIAL_MERCHANT_CONVERSATIONS);
    const nextLeads = loadStoredCollection('leads', bizId, INITIAL_MERCHANT_LEADS);
    const nextOrders = loadStoredOrders(bizId, bizName, INITIAL_MERCHANT_ORDERS);
    const nextPromotions = loadStoredCollection('promotions', bizId, INITIAL_MERCHANT_PROMOTIONS);

    setProducts(nextProducts);
    setServices(nextServices);
    setOffers(nextOffers);
    setPosts(nextPosts);
    setEvents(nextEvents);
    setReviews(nextReviews);
    setConversations(nextConversations);
    setActiveConversationId(nextConversations[0]?.id || '');
    setLeads(nextLeads);
    setOrders(nextOrders);
    setPromotions(nextPromotions);
  }, [currentBusiness.id, currentBusiness.name]);"""

    new_sync = """  // Synchronize collections whenever currentBusiness switches
  useEffect(() => {
    const bizId = currentBusiness.id;
    const bizName = currentBusiness.name;

    const nextServices = loadStoredCollection('services', bizId, INITIAL_MERCHANT_SERVICES);
    const nextOffers = loadStoredCollection('offers', bizId, INITIAL_MERCHANT_OFFERS);
    const nextPosts = loadStoredCollection('posts', bizId, INITIAL_MERCHANT_POSTS);
    const nextEvents = loadStoredCollection('events', bizId, INITIAL_MERCHANT_EVENTS);
    const nextReviews = loadStoredCollection('reviews', bizId, INITIAL_MERCHANT_REVIEWS);
    const nextConversations = loadStoredCollection('conversations', bizId, INITIAL_MERCHANT_CONVERSATIONS);
    const nextLeads = loadStoredCollection('leads', bizId, INITIAL_MERCHANT_LEADS);
    const nextOrders = loadStoredOrders(bizId, bizName, INITIAL_MERCHANT_ORDERS);
    const nextPromotions = loadStoredCollection('promotions', bizId, INITIAL_MERCHANT_PROMOTIONS);

    // Note: products is managed authoritatively by Server-First sync below
    setServices(nextServices);
    setOffers(nextOffers);
    setPosts(nextPosts);
    setEvents(nextEvents);
    setReviews(nextReviews);
    setConversations(nextConversations);
    setActiveConversationId(nextConversations[0]?.id || '');
    setLeads(nextLeads);
    setOrders(nextOrders);
    setPromotions(nextPromotions);
  }, [currentBusiness.id, currentBusiness.name]);"""

    if old_sync in text:
        text = text.replace(old_sync, new_sync)
        print("Updated sync useEffect in MerchantPortal.tsx")
    else:
        print("old_sync not found in MerchantPortal.tsx")

    # 3. Update server-first sync block
    old_server_sync = """    // Authoritative Server-First Sync for Catalog & Orders
    getMerchantProducts(currentBusiness.id, currentBusiness.name).then((serverProds) => {
      if (serverProds !== null && isMounted) {
        setProducts(serverProds);
        try {
          localStorage.setItem(`myarea24_merchant_products_${currentBusiness.id}`, JSON.stringify(serverProds));
        } catch {}
      }
    });"""

    new_server_sync = """    // Authoritative Server-First Sync: GET /api/v1/products?business_id=X runs before loading localStorage
    getMerchantProducts(currentBusiness.id, currentBusiness.name).then((serverProds) => {
      if (!isMounted) return;
      if (serverProds !== null) {
        // Server returned authoritative catalog
        setProducts(serverProds);
        try {
          localStorage.setItem(`myarea24_merchant_products_${currentBusiness.id}`, JSON.stringify(serverProds));
        } catch {}
      } else {
        // Server unreachable / offline: fallback to localStorage cache
        const offlineProds = loadStoredCollection('products', currentBusiness.id, INITIAL_MERCHANT_PRODUCTS);
        setProducts(offlineProds);
      }
    });"""

    if old_server_sync in text:
        text = text.replace(old_server_sync, new_server_sync)
        print("Updated server-first sync block in MerchantPortal.tsx")
    else:
        print("old_server_sync not found in MerchantPortal.tsx")

    with open(path, "w", encoding="utf-8") as f:
        f.write(text.replace("\n", "\r\n"))

if __name__ == "__main__":
    update_merchant_portal_server_first()
