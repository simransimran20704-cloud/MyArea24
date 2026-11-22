import React, { useState, useEffect } from 'react';



import { useSearchParams, useNavigate } from 'react-router-dom';



import { DashboardId, ActionModalData, SavedEntry } from '../../types';



import { HeroBanner } from '../../components/HeroBanner';



import { InteractiveMap } from '../../components/InteractiveMap';



import { LiveAreaIntelligence } from '../../services/liveIntelligence';



import { UserLocation } from '../../components/LocationPickerModal';



import {



  LiveCommunityMarketplaceState,



  LiveProductItem,



  LiveBusinessItem,



  searchProductsOnBackend,



  searchBusinessesOnBackend,



} from '../../services/communityMarketplaceService';



import { getStoredAuthUser } from '../../services/authService';



import {



  MapPin,



  Sun,



  CloudRain,



  Wind,



  Droplets,



  Car,



  Sparkles,



  ArrowRight,



  ChevronRight,



  Heart,



  Bookmark,



  Star,



  Clock,



  Calendar,



  Utensils,



  Coffee,



  ShoppingBag,



  Hospital,



  GraduationCap,



  Trees,



  CreditCard,



  Dumbbell,



  Scissors,



  Landmark,



  MoreHorizontal,



  ShieldCheck,



  Radio,



  MessageSquare,



  Plus,



  Minus,



  Check,



  Wrench,



  Gift,



  Bell,



  Search,



  Fuel,



  TrendingUp,



  Phone,



  Copy,



  Store,



  X,



  Zap,



  MessageCircle,



  CheckCircle2,



} from 'lucide-react';



import { BusinessCard } from '../../components/BusinessCard';



import { ProductCard } from '../../components/ProductCard';



import { AlertBanner } from '../../components/AlertBanner';



import { DashboardCommonProps, EMPTY_MARKETPLACE } from './types';



export const ProductsDashboard: React.FC<DashboardCommonProps> = ({



  onNavigate,



  onOpenMerchantRegistration,



  onOpenModal,



  onAskAi,



  searchQuery,



  currentLocation,



  selectedArea,



  liveIntel,



  marketplace: propMarketplace,



  onAddToCart,



}) => {



  const marketplace = propMarketplace || EMPTY_MARKETPLACE;



  const navigate = useNavigate();



  const [searchParams, setSearchParams] = useSearchParams();



  const urlCat = searchParams.get('cat') || 'All';



  const [selectedCat, setSelectedCat] = useState(urlCat);



  useEffect(() => {



    if (urlCat !== selectedCat) {



      setSelectedCat(urlCat);



    }



  }, [urlCat]);



  const handleSelectCategory = (cat: string) => {



    setSelectedCat(cat);



    const next = new URLSearchParams(searchParams);



    if (cat === 'All') {



      next.delete('cat');



    } else {



      next.set('cat', cat);



    }



    setSearchParams(next, { replace: true });



  };



  const [addedIds, setAddedIds] = useState<string[]>([]);



  const [serverProducts, setServerProducts] = useState<LiveProductItem[] | null>(null);



  const [isSearchingServer, setIsSearchingServer] = useState(false);



  const effectiveQuery = (searchQuery || searchParams.get('q') || '').trim();



  useEffect(() => {



    if (!effectiveQuery || effectiveQuery.length < 2) {



      setServerProducts(null);



      return;



    }



    let cancelled = false;



    const timer = setTimeout(async () => {



      setIsSearchingServer(true);



      try {



        const results = await searchProductsOnBackend({



          q: effectiveQuery,



          category: selectedCat !== 'All' ? selectedCat : undefined,



          pincode: currentLocation?.pincode,



          locality: selectedArea.split(',')[0]?.trim(),



          city: selectedArea.split(',')[1]?.trim(),



          userLat: currentLocation?.coords?.lat,



          userLon: currentLocation?.coords?.lng,



          pageSize: 30,



        });



        if (!cancelled) {



          setServerProducts(results);



        }



      } catch (err) {



        // fallback to local filter



      } finally {



        if (!cancelled) setIsSearchingServer(false);



      }



    }, 300);



    return () => {



      cancelled = true;



      clearTimeout(timer);



    };



  }, [effectiveQuery, selectedCat, currentLocation, selectedArea]);



  const shortArea = selectedArea.split(',')[0]?.trim() || selectedArea;



  const { mandiRates, fuelRates } = liveIntel;



  const categories = [



    'All',



    'Groceries',



    'Bakery & Dairy',



    'Medicines',



    'Electronics',



    'Home & Kitchen',



  ];



  const localFiltered = marketplace.products.filter((p) => {



    const matchesCat =



      selectedCat === 'All' ||



      p.cat.toLowerCase().includes(selectedCat.toLowerCase()) ||



      selectedCat.toLowerCase().includes(p.cat.toLowerCase());



    const matchesQuery =



      !effectiveQuery ||



      p.name.toLowerCase().includes(effectiveQuery.toLowerCase()) ||



      p.brand.toLowerCase().includes(effectiveQuery.toLowerCase()) ||



      p.cat.toLowerCase().includes(effectiveQuery.toLowerCase()) ||



      p.store.toLowerCase().includes(effectiveQuery.toLowerCase());



    return matchesCat && matchesQuery;



  });



  const displayProducts = serverProducts !== null ? serverProducts : localFiltered;



  const nearbyStores = marketplace.businesses.slice(0, 4);



  const handleAdd = (p: any) => {



    setAddedIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));



    onAddToCart?.({



      id: p.id,



      name: p.name,



      price: p.localPriceNum || 99,



      oldPrice: p.oldPrice,



      image: p.img,



      store: p.store || 'Neighborhood Store',



      dist: p.dist || '650m',



      quantity: 1,



      cat: p.cat,



    });



  };



  return (



    <div className="space-y-4">



      <HeroBanner



        dashboardId="products"



        tag={



          <>



            <MapPin className="w-3.5 h-3.5 text-blue-300" />



            <span>{selectedArea}</span>



          </>



        }



        title={



          <>



            Everyday Products,



            <br />



            <span className="text-[#93C5FD]">Right Around You</span>



          </>



        }



        description={`Compare offline neighborhood store prices vs. quick-commerce apps in ${shortArea} and check live APMC Mandi & Fuel benchmarks.`}



        bottomPills={[



          { icon: <span>🧺</span>, label: 'Groceries nearby', onClick: () => setSelectedCat('Groceries') },



          { icon: <span>🥛</span>, label: 'Fresh Dairy & Bakery', onClick: () => setSelectedCat('Bakery & Dairy') },



          { icon: <span>💊</span>, label: 'Pharmacies open now', onClick: () => setSelectedCat('Medicines') },



          { icon: <span>📱</span>, label: 'Electronics stores', onClick: () => setSelectedCat('Electronics') },



        ]}



        primaryCta={{



          label: 'Compare Offline vs Online Savings',



          onClick: () => handleSelectCategory('Groceries'),



        }}



      />



      {/* Category Pills */}



      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">



        {categories.map((cat) => (



          <button



            key={cat}



            type="button"



            onClick={() => handleSelectCategory(cat)}



            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${



              selectedCat === cat



                ? 'bg-blue-600 text-white border-blue-600'



                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'



            }`}



          >



            {cat}



          </button>



        ))}



      </div>



      {/* Main Grid: Left (8 cols) + Right (4 cols) */}



      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">



        <div className="xl:col-span-8 space-y-4">



          {/* Popular Products in Your Area */}



          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">



            <div className="flex items-center justify-between mb-3">



              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">



                <span>🔥</span> Popular Products & Offline vs. Online Price Comparison ({shortArea})



              </h3>



              <span className="text-[11px] font-semibold text-emerald-600">



                ● Live Store Inventory



              </span>



            </div>



            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">



              {marketplace.loading ? (
                <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-3 bg-white space-y-3 animate-pulse">
                      <div className="h-32 bg-slate-200 rounded-lg" />
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                      <div className="h-8 bg-slate-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : displayProducts.length === 0 ? (



                <div className="col-span-full py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">



                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">



                    🛍️



                  </div>



                  <h4 className="text-base font-bold text-slate-800">



                    {effectiveQuery



                      ? `No products found matching "${effectiveQuery}" in ${shortArea}`



                      : `No verified online stores registered in this pocket yet.`}



                  </h4>



                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">



                    {effectiveQuery



                      ? 'Try searching with a broader keyword, check another category, or list this product if you are a local seller.'



                      : `Are you a local shop owner in ${shortArea}?`}



                  </p>



                  <div className="flex items-center justify-center gap-2">



                    {effectiveQuery && (



                      <button



                        type="button"



                        onClick={() => {



                          const next = new URLSearchParams(searchParams);



                          next.delete('q');



                          setSearchParams(next, { replace: true });



                        }}



                        className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"



                      >



                        Clear Search



                      </button>



                    )}







                  </div>



                </div>



              ) : (



                displayProducts.map((p) => (



                  <ProductCard



                    key={p.id}



                    product={p}



                    isAdded={addedIds.includes(p.id)}



                    onAddToCart={handleAdd}



                    onOpenModal={onOpenModal}



                    onNavigateProduct={(id) => navigate(`/products/${id}`)}



                  />



                ))



              )}



            </div>



          </div>



          {/* Nearby Stores */}



          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">



            <div className="flex items-center justify-between mb-3">



              <h3 className="text-sm font-extrabold text-slate-900">Nearby Stores in {shortArea}</h3>



              <button



                type="button"



                onClick={() => onNavigate('businesses')}



                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"



              >



                <span>View all</span>



                <ArrowRight className="w-3.5 h-3.5" />



              </button>



            </div>



            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">



              {nearbyStores.map((st) => (



                <div



                  key={st.id}



                  onClick={() =>



                    onOpenModal({



                      title: st.name,



                      subtitle: st.sub,



                      category: 'Verified Local Merchant',



                      badge: st.status,



                      rating: `${st.rating} ${st.reviews}`,



                      location: `${st.dist} away • ${st.address}`,



                      description: `${st.description}\n📞 Direct Store Contact: ${st.phone}`,



                      primaryActionLabel: `Call ${st.phone}`,



                      image: st.img,



                      phone: st.phone,



                      whatsapp: st.whatsapp || st.phone,



                      address: st.address,



                      source: st.source || 'Verified Storefront',



                      verified: true,



                      freshnessLabel: 'Active Merchant',



                    })



                  }



                  className="cursor-pointer rounded-xl border border-slate-200/80 overflow-hidden hover:shadow-md transition bg-white"



                >



                  <div className="relative h-24">



                    <img src={st.img} alt={st.name} className="w-full h-full object-cover" />



                    <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold">



                      {st.status}



                    </span>



                  </div>



                  <div className="p-2.5">



                    <h4 className="text-xs font-extrabold text-slate-900 truncate">{st.name}</h4>



                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">



                      <span className="text-amber-600 font-bold">★ {st.rating} {st.reviews}</span>



                      <span>📍 {st.dist}</span>



                    </div>



                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{st.cat}</p>



                    <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{st.closes}</p>



                  </div>



                </div>



              ))}



            </div>



          </div>



          {/* AI Recommendations for You */}



          <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/60 rounded-2xl p-4 border border-indigo-100">



            <div className="flex items-center justify-between mb-2.5">



              <div className="flex items-center gap-2">



                <Sparkles className="w-4 h-4 text-indigo-600" />



                <h3 className="text-xs font-extrabold text-slate-900">AI Shopping Insights for {shortArea}</h3>



                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">LIVE</span>



              </div>



              <button



                type="button"



                onClick={() => onNavigate('ai-assistant')}



                className="text-xs font-semibold text-blue-600"



              >



                See more →



              </button>



            </div>



            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">



              {[



                { title: `Best places to buy fresh vegetables in ${shortArea}`, sub: 'APMC Mandi linked stores within 1 km', icon: '🥦' },



                { title: `24×7 Pharmacies open now in ${shortArea}`, sub: 'With doorstep delivery options', icon: '💊' },



                { title: `Electronics stores with ongoing offers in ${shortArea}`, sub: 'Smart TVs, accessories and repair', icon: '📱' },



              ].map((item) => (



                <button



                  key={item.title}



                  type="button"



                  onClick={() => onAskAi(item.title)}



                  className="bg-white rounded-xl p-2.5 border border-slate-200/80 hover:border-indigo-300 flex items-center justify-between gap-2 text-left transition"



                >



                  <div className="flex items-center gap-2.5 min-w-0">



                    <span className="text-xl">{item.icon}</span>



                    <div className="min-w-0">



                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{item.title}</p>



                      <p className="text-[10px] text-slate-500 line-clamp-1">{item.sub}</p>



                    </div>



                  </div>



                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />



                </button>



              ))}



            </div>



          </div>



        </div>



        {/* Right Column (4 cols): Today's Best Deals + Live APMC Mandi & Fuel Price Insights */}



        <div className="xl:col-span-4 space-y-4">



          {/* Today's Best Deals Near You */}



          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">



            <div className="flex items-center justify-between mb-3">



              <h3 className="text-sm font-extrabold text-slate-900">Today's Best Deals in {shortArea}</h3>



              <button



                type="button"



                onClick={() => onNavigate('offers')}



                className="text-xs font-semibold text-blue-600 flex items-center gap-1"



              >



                <span>View all</span>



                <ArrowRight className="w-3 h-3" />



              </button>



            </div>



            <div className="grid grid-cols-2 gap-2.5">



              {marketplace.products.slice(0, 4).map((deal) => (



                <div



                  key={deal.id}



                  onClick={() => handleAdd(deal)}



                  className="cursor-pointer p-2.5 rounded-xl border border-slate-200/80 hover:border-blue-300 transition bg-slate-50/40"



                >



                  <div className="min-w-0">



                    <p className="text-xs font-bold text-slate-900 truncate">{deal.name}</p>



                    <p className="text-xs font-extrabold text-slate-900 mt-0.5">



                      {deal.price}{' '}



                      {deal.oldPrice && (



                        <span className="text-[10px] text-slate-400 line-through font-normal">{deal.oldPrice}</span>



                      )}



                    </p>



                    <span className="inline-block px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[9px] font-extrabold mt-0.5">



                      {deal.discount || `Save ${deal.savingsPercent}%`}



                    </span>



                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{deal.store}</p>



                  </div>



                </div>



              ))}



            </div>



          </div>



          {/* Live APMC Mandi & Fuel Price Insights for Your Area */}



          <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/70">



            <div className="flex items-center justify-between mb-3">



              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">



                <span className="text-blue-600">📈</span> Live Mandi & Fuel Rates ({fuelRates.city})



              </h3>



              <button



                type="button"



                onClick={() => onNavigate('market-rates')}



                className="text-xs font-semibold text-blue-600 flex items-center gap-1"



              >



                <span>Full table</span>



                <ArrowRight className="w-3 h-3" />



              </button>



            </div>



            <div className="space-y-2.5">



              {mandiRates.slice(0, 7).map((row) => (



                <div



                  key={row.commodity}



                  onClick={() => onNavigate('market-rates')}



                  className="cursor-pointer flex items-center justify-between gap-2 pb-2 border-b border-slate-100"



                >



                  <div className="flex items-center gap-2.5">



                    <span className="text-xl">{row.icon}</span>



                    <div>



                      <p className="text-xs font-bold text-slate-800">



                        {row.commodity} (1 {row.unit})



                      </p>



                      <p className="text-[10px] text-slate-400">{row.mandiName}</p>



                    </div>



                  </div>



                  <div className="text-right">



                    <p className="text-xs font-extrabold text-slate-900">₹{row.pricePerKg}</p>



                    <p className="text-[10px] font-bold text-emerald-600">{row.trend}</p>



                  </div>



                </div>



              ))}



              {/* Fuel Benchmark Row */}



              <div



                onClick={() => onNavigate('fuel-rates')}



                className="cursor-pointer pt-1 flex items-center justify-between text-xs"



              >



                <div>



                  <p className="font-extrabold text-slate-900">⛽ Petrol / Diesel / CNG</p>



                  <p className="text-[10px] text-slate-500">{fuelRates.city} OMC Retail</p>



                </div>



                <div className="text-right">



                  <p className="font-extrabold text-slate-900">



                    {fuelRates.petrol > 0



                      ? `₹${fuelRates.petrol.toFixed(2)} / ₹${fuelRates.diesel.toFixed(2)}`



                      : 'Updating...'}



                  </p>



                  <p className="text-[10px] font-bold text-emerald-600">



                    {fuelRates.cng > 0 ? `CNG ₹${fuelRates.cng.toFixed(2)}/kg` : 'Updating...'}



                  </p>



                </div>



              </div>



            </div>



          </div>



        </div>



      </div>



    </div>



  );



};

