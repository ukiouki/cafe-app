"use client";

import { useEffect, useState, Suspense } from "react"; // Suspenseを追加
import { collection, onSnapshot, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSearchParams } from "next/navigation"; // 追加

type Topping = { name: string; price: number };

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
  hasSpicyOption?: boolean;
  hasCorianderOption?: boolean;
  toppings?: Topping[];
};

type Order = {
  id: string;
  tableNumber: number;
  items: any[];
  totalPrice: number;
  status: string;
};

type CartItem = {
  menuId: string;
  name: string;
  basePrice: number;
  totalPrice: number;
  quantity: number;
  options: {
    spicy?: string;
    coriander?: string;
    selectedToppings: Topping[];
    memo: string;
  };
};

type Category = { id: string; name: string };

// --- メインのロジックを分離（useSearchParamsを使うため） ---
function OrderPageContent() {
  const searchParams = useSearchParams();
  // URLの ?table=◯ を取得。無ければデフォルトで 1
  const tableNum = Number(searchParams.get("table")) || 1;

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [tableNames, setTableNames] = useState<{ [key: number]: string }>({});
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("");

  const [optionPopupItem, setOptionPopupItem] = useState<MenuItem | null>(null);
  const [selectedSpicy, setSelectedSpicy] = useState("無し");
  const [selectedCoriander, setSelectedCoriander] = useState("有り");
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [userMemo, setUserMemo] = useState("");

  const haptic = () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
  };

  useEffect(() => {
    const unsubMenu = onSnapshot(collection(db, "menus"), (snapshot) => {
      setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuItem[]);
      setLoading(false);
    });

    const unsubCats = onSnapshot(collection(db, "categories"), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })) as Category[];
      setCategories(cats);
      if (cats.length > 0) {
        setActiveCategory(prev => {
          if (!prev || !cats.some(c => c.name === prev)) return cats[0].name;
          return prev;
        });
      }
    });

    onSnapshot(doc(db, "settings", "tables"), (docSnap) => {
      if (docSnap.exists()) setTableNames(docSnap.data().names || {});
    });

    const unsubOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      // 修正：URLから取得した tableNum でフィルタリング
      setAllOrders(orders.filter(o => o.tableNumber === tableNum && o.status !== "checked_out"));
    });

    return () => { unsubMenu(); unsubCats(); unsubOrders(); };
  }, [tableNum]); // tableNumが変わったら再取得

  const historyTotal = allOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  const handleOpenOptions = (item: MenuItem) => {
    haptic();
    setOptionPopupItem(item);
    setSelectedSpicy("無し");
    setSelectedCoriander("有り");
    setSelectedToppings([]);
    setUserMemo("");
  };

  const removeFromCart = (index: number) => {
    haptic();
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const addToCart = () => {
    haptic();
    if (!optionPopupItem) return;
    const toppingTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    
    const cleanOptions: any = {
      selectedToppings: selectedToppings,
      memo: userMemo || ""
    };
    if (optionPopupItem.hasSpicyOption) cleanOptions.spicy = selectedSpicy;
    if (optionPopupItem.hasCorianderOption) cleanOptions.coriander = selectedCoriander;

    const newItem: CartItem = {
      menuId: optionPopupItem.id,
      name: optionPopupItem.name,
      basePrice: optionPopupItem.price,
      totalPrice: optionPopupItem.price + toppingTotal,
      quantity: 1,
      options: cleanOptions,
    };
    
    setCart((prev) => [...prev, newItem]);
    setOptionPopupItem(null);
  };

  const handleOrderSubmit = async () => {
    haptic();
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "orders"), {
        // 修正：URLから取得した tableNum を使用
        tableNumber: tableNum,
        tableName: tableNames[tableNum] || `TABLE ${tableNum}`,
        items: cart,
        totalPrice: cart.reduce((s, i) => s + i.totalPrice, 0),
        status: "preparing",
        createdAt: serverTimestamp(),
      });
      alert("ご注文を承りました！");
      setCart([]);
      setIsCartOpen(false);
    } catch (e: any) {
      alert(`送信に失敗しました: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-zinc-300 tracking-widest">LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#1a1a1a] pb-44 text-left font-sans leading-relaxed">
      {/* HEADER */}
      <header className="fixed top-0 w-full bg-white/90 backdrop-blur-xl z-30 border-b border-zinc-100 shadow-sm">
        <div className="p-5 flex justify-between items-center">
          <div className="flex flex-col text-left">
            <h1 className="text-2xl font-black italic tracking-tighter leading-none">ORDER</h1>
            <span className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase mt-1">Guest Table</span>
          </div>
          <div className="flex gap-3 items-center">
            <button 
              onClick={() => { haptic(); setIsHistoryOpen(true); }} 
              className="bg-zinc-100 hover:bg-zinc-200 text-[#1a1a1a] text-[11px] font-black px-4 py-2 rounded-full transition-all active:scale-95"
            >
              注文履歴
            </button>
            <div className="bg-[#1a1a1a] text-white px-5 py-2 rounded-2xl text-xs font-black shadow-xl shadow-zinc-200">
              {/* 修正：URLの番号を表示 */}
              {tableNames[tableNum] || `TABLE ${tableNum}`}
            </div>
          </div>
        </div>
        
        <div className="flex px-4 overflow-x-auto no-scrollbar gap-2 pb-4">
          {categories.map((cat) => (
            <button 
              key={cat.id} 
              onClick={() => { haptic(); setActiveCategory(cat.name); }} 
              className={`px-7 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap tracking-wider ${
                activeCategory === cat.name ? "bg-[#1a1a1a] text-white shadow-lg" : "bg-white text-zinc-500 border border-zinc-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* MENU LIST */}
      <main className="pt-48 px-6 max-w-lg mx-auto space-y-10">
        <div className="space-y-6">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] px-1 text-left">Menu List</h2>
          <div className="space-y-5">
            {menus.filter(m => m.category === activeCategory).map((item) => (
              <div key={item.id} className={`flex justify-between items-center group ${!item.isAvailable ? "opacity-30 grayscale" : ""}`}>
                <div className="text-left space-y-1">
                  <h3 className="font-black text-lg text-[#1a1a1a]">{item.name}</h3>
                  <p className="text-[15px] font-bold text-zinc-600">¥{item.price.toLocaleString()}</p>
                </div>
                {item.isAvailable ? (
                  <button 
                    onClick={() => handleOpenOptions(item)} 
                    className="bg-white border-2 border-zinc-100 text-[#1a1a1a] w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-md active:bg-[#1a1a1a] active:text-white active:border-[#1a1a1a] active:scale-90 transition-all duration-200"
                  >
                    <span className="text-2xl font-light">＋</span>
                  </button>
                ) : (
                  <span className="bg-zinc-50 text-zinc-400 border border-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center">Sold Out</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER ORDER BAR */}
      <div className="fixed bottom-0 w-full p-6 bg-gradient-to-t from-[#fdfcfb] via-[#fdfcfb] to-transparent z-20">
        <button 
          onClick={() => { haptic(); setIsCartOpen(true); }} 
          disabled={cart.length === 0} 
          className={`w-full max-w-md mx-auto flex justify-between items-center px-8 py-5 rounded-[2.25rem] shadow-2xl transition-all duration-300 ${
            cart.length === 0 
            ? "bg-zinc-100 text-zinc-300 translate-y-2 opacity-0 pointer-events-none" 
            : "bg-[#1a1a1a] text-white active:scale-95 translate-y-0"
          }`}
        >
          <span className="font-black tracking-widest text-sm">注文内容を確認</span>
          <div className="flex items-center gap-3">
            <span className="h-6 w-px bg-white/20" />
            <span className="text-lg font-bold">¥{cart.reduce((s, i) => s + i.totalPrice, 0).toLocaleString()}</span>
          </div>
        </button>
      </div>

      {/* OPTIONS POPUP */}
      {optionPopupItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center">
          <div className="bg-[#fdfcfb] w-full max-w-md rounded-t-[3.5rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto text-left border-t border-white">
            <div className="flex justify-between items-start mb-12">
              <div className="space-y-1 text-left">
                <h2 className="text-2xl font-black text-[#1a1a1a]">{optionPopupItem.name}</h2>
                <p className="text-lg text-zinc-500 font-bold">¥{optionPopupItem.price.toLocaleString()}</p>
              </div>
              <button onClick={() => { haptic(); setOptionPopupItem(null); }} className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center text-2xl text-zinc-500 active:bg-zinc-200 transition-all">×</button>
            </div>

            <div className="space-y-12 pb-10 text-left">
              {optionPopupItem.hasSpicyOption && (
                <div className="space-y-5">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] block">🌶 辛さを選ぶ</label>
                  <div className="grid grid-cols-4 gap-3">
                    {["無し", "小", "中", "大"].map(lv => (
                      <button key={lv} onClick={() => { haptic(); setSelectedSpicy(lv); }} className={`py-4 rounded-2xl font-black text-sm border-2 transition-all ${selectedSpicy === lv ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-lg" : "bg-white text-zinc-500 border-zinc-100"}`}>{lv}</button>
                    ))}
                  </div>
                </div>
              )}

              {optionPopupItem.hasCorianderOption && (
                <div className="space-y-5">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] block">🌿 パクチー</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["有り", "無し"].map(opt => (
                      <button key={opt} onClick={() => { haptic(); setSelectedCoriander(opt); }} className={`py-4 rounded-2xl font-black text-sm border-2 transition-all ${selectedCoriander === opt ? "bg-green-700 text-white border-green-700 shadow-lg" : "bg-white text-zinc-500 border-zinc-100"}`}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}

              {optionPopupItem.toppings && optionPopupItem.toppings.length > 0 && (
                <div className="space-y-5 text-left">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] block text-left">トッピングを追加</label>
                  <div className="space-y-3">
                    {optionPopupItem.toppings.map(t => (
                      <button 
                        key={t.name} 
                        onClick={() => { haptic(); setSelectedToppings(prev => prev.find(s => s.name === t.name) ? prev.filter(x => x.name !== t.name) : [...prev, t]); }} 
                        className={`flex justify-between items-center p-6 rounded-2xl border-2 transition-all font-black text-[15px] ${selectedToppings.find(s => s.name === t.name) ? "bg-zinc-50 border-[#1a1a1a] text-[#1a1a1a] shadow-md" : "bg-white text-zinc-500 border-zinc-100"}`}
                      >
                        <span className="text-left">{t.name}</span>
                        <span className="font-bold text-[#1a1a1a]">+¥{t.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea 
                value={userMemo} 
                onChange={(e) => setUserMemo(e.target.value)} 
                placeholder="アレルギーや抜き物のご希望があれば..." 
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-[2rem] p-6 text-[15px] font-bold h-32 outline-none focus:border-zinc-300 transition-all placeholder:font-normal placeholder:text-zinc-400" 
              />
              <button onClick={addToCart} className="w-full bg-[#1a1a1a] text-white font-black py-6 rounded-[2.5rem] shadow-xl tracking-[0.15em] text-lg active:scale-[0.98] transition-all">カートに追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* CART CHECKOUT MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center">
          <div className="bg-[#fdfcfb] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border border-white animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-8 tracking-widest text-[#1a1a1a]">ご注文内容の確認</h2>
            <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto px-1 no-scrollbar text-left">
              {cart.map((item, i) => (
                <div key={i} className="border-b-2 border-zinc-50 pb-5 text-left group">
                  <div className="flex justify-between items-start mb-2 text-left">
                    <span className="font-black text-[16px] flex-1 pr-3 text-left">{item.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-zinc-800">¥{item.totalPrice.toLocaleString()}</span>
                      <button 
                        onClick={() => removeFromCart(i)} 
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100 shadow-sm active:scale-75 transition-all"
                      >
                        <span className="text-xl font-light">×</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-500 flex flex-wrap gap-x-3 font-bold">
                    {item.options.spicy && <span>🌶 {item.options.spicy}</span>}
                    {item.options.coriander && <span>🌿 パクチー:{item.options.coriander}</span>}
                    {item.options.selectedToppings.map(t => <span key={t.name}>+{t.name}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-baseline font-black text-2xl mb-10 px-1 border-t-2 border-zinc-100 pt-6">
              <span className="text-xs uppercase text-zinc-400 tracking-[0.2em]">Total</span>
              <span className="text-4xl font-bold text-[#1a1a1a]">¥{cart.reduce((s, i) => s + i.totalPrice, 0).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setIsCartOpen(false)} className="py-4 font-black text-zinc-400 text-sm tracking-widest">戻る</button>
              <button 
                onClick={handleOrderSubmit} 
                disabled={isSubmitting} 
                className="bg-[#1a1a1a] text-white py-5 rounded-2xl font-black shadow-xl text-[13px] tracking-widest active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "送信中..." : "確定する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER HISTORY MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 text-left">
          <div className="bg-[#fdfcfb] w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white animate-in zoom-in-95 duration-200">
            <div className="bg-[#1a1a1a] p-8 text-white text-center relative">
              <button onClick={() => setIsHistoryOpen(false)} className="absolute top-6 right-6 text-3xl font-light text-zinc-400">×</button>
              <p className="text-[10px] tracking-[0.3em] font-bold text-zinc-400 mb-1 uppercase">Receipt</p>
              <h2 className="text-2xl font-black italic mb-2 text-zinc-100">ご注文状況</h2>
              <div className="h-1.5 w-12 bg-orange-600 mx-auto rounded-full" />
            </div>
            <div className="p-8 text-left">
              <div className="text-center mb-10 text-left">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 text-center">現在の合計金額</p>
                <p className="text-5xl font-bold text-[#1a1a1a] text-center">¥{historyTotal.toLocaleString()}</p>
              </div>
              <div className="space-y-4 max-h-[35vh] overflow-y-auto mb-10 border-y-2 border-zinc-100 py-6 custom-scrollbar text-left">
                {allOrders.length > 0 ? allOrders.flatMap(o => o.items).map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-1 text-left">
                    <div className="flex flex-col text-left">
                      <span className="font-black text-zinc-800 text-[15px] leading-tight text-left">{item.name}</span>
                      {item.quantity > 1 && <span className="text-[10px] text-orange-700 font-bold mt-0.5">数量: {item.quantity}</span>}
                    </div>
                    <span className="font-bold text-zinc-700">¥{item.totalPrice?.toLocaleString()}</span>
                  </div>
                )) : (
                  <div className="py-10 text-center space-y-2 text-left">
                    <p className="text-zinc-300 font-black tracking-widest text-center">NO ORDERS YET</p>
                    <p className="text-[10px] text-zinc-400 font-bold text-center">まだ注文がありません</p>
                  </div>
                )}
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="w-full bg-[#1a1a1a] text-white py-5 rounded-[2rem] font-black shadow-xl tracking-[0.2em] active:scale-95 transition-all text-sm uppercase">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 最終的にエクスポートするコンポーネント ---
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-zinc-300 tracking-widest">LOADING...</div>}>
      <OrderPageContent />
    </Suspense>
  );
}