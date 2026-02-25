"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";

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
  items: { name: string; quantity: number; totalPrice: number; options: any }[];
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

export default function StaffOrder() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [tableNames, setTableNames] = useState<{ [key: string]: string }>({});
  const [tableCount, setTableCount] = useState(8);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNum, setTableNum] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("アペタイザー");
  const [optionPopupItem, setOptionPopupItem] = useState<MenuItem | null>(null);
  
  const [selectedSpicy, setSelectedSpicy] = useState("無し");
  const [selectedCoriander, setSelectedCoriander] = useState("有り");
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [userMemo, setUserMemo] = useState("");
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const haptic = () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
  };

  useEffect(() => {
    onSnapshot(collection(db, "menus"), (snapshot) => {
      setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuItem[]);
    });

    onSnapshot(doc(db, "settings", "tables"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTableCount(data.count || 8);
        setTableNames(data.names || {});
      }
    });

    onSnapshot(collection(db, "orders"), (snapshot) => {
      setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    });
  }, []);

  const getTableName = (num: number) => {
    return tableNames[num] || tableNames[num.toString()] || `${num}番テーブル`;
  };

  const currentTableOrders = allOrders.filter(o => o.tableNumber === tableNum && o.status !== "checked_out");
  const currentTableTotal = currentTableOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  const handleCheckout = async () => {
    if (!tableNum || currentTableOrders.length === 0) return;
    if (!confirm(`${getTableName(tableNum)} のお会計を完了しますか？`)) return;

    haptic();
    try {
      const batch = writeBatch(db);
      currentTableOrders.forEach((order) => {
        const orderRef = doc(db, "orders", order.id);
        batch.update(orderRef, { status: "checked_out" });
      });
      await batch.commit();
      setIsBillOpen(false);
      setTableNum(null);
    } catch (e) {
      alert("エラーが発生しました");
    }
  };

  const removeFromCart = (index: number) => {
    haptic();
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleOpenOptions = (item: MenuItem) => {
    haptic();
    if (!item.isAvailable) return;
    setOptionPopupItem(item);
    setSelectedSpicy("無し");
    setSelectedCoriander("有り");
    setSelectedToppings([]);
    setUserMemo("");
  };

  const addToCart = () => {
    haptic();
    if (!optionPopupItem) return;
    const toppingTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    const unitPrice = optionPopupItem.price + toppingTotal;

    const cleanOptions: any = {
      selectedToppings: selectedToppings,
      memo: userMemo || ""
    };
    if (optionPopupItem.hasSpicyOption) cleanOptions.spicy = selectedSpicy;
    if (optionPopupItem.hasCorianderOption) cleanOptions.coriander = selectedCoriander;
    
    setCart((prev) => {
      const existingIndex = prev.findIndex(item => 
        item.menuId === optionPopupItem.id && 
        JSON.stringify(item.options) === JSON.stringify(cleanOptions)
      );

      if (existingIndex > -1) {
        const updatedCart = [...prev];
        updatedCart[existingIndex].quantity += 1;
        return updatedCart;
      } else {
        return [...prev, {
          menuId: optionPopupItem.id,
          name: optionPopupItem.name,
          basePrice: optionPopupItem.price,
          totalPrice: unitPrice,
          quantity: 1,
          options: cleanOptions
        }];
      }
    });
    setOptionPopupItem(null);
  };

  const handleOrderSubmit = async () => {
    if (!tableNum || cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const orderTotalPrice = cart.reduce((s, i) => s + (i.totalPrice * i.quantity), 0);
      await addDoc(collection(db, "orders"), {
        tableNumber: tableNum,
        tableName: getTableName(tableNum),
        items: cart,
        totalPrice: orderTotalPrice,
        status: "preparing",
        createdAt: serverTimestamp(),
      });
      setCart([]);
    } catch (e: any) {
      alert(`送信に失敗しました: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#332f2e] pb-64 font-sans leading-relaxed">
      {/* HEADER */}
      <header className="sticky top-0 bg-[#1a1a1a] text-white z-30 shadow-2xl">
        <div className="py-6 text-center">
          <p className="font-serif italic text-2xl tracking-widest text-zinc-100">Staff Handy</p>
        </div>
        <div className="flex p-1.5 bg-zinc-800/80 backdrop-blur-md overflow-x-auto no-scrollbar border-t border-white/10">
          {["アペタイザー", "ハンバーガー", "ドリンク"].map((cat) => (
            <button
              key={cat}
              onClick={() => { haptic(); setActiveCategory(cat); }}
              className={`flex-1 py-3.5 px-6 text-xs font-black tracking-wider transition-all rounded-lg whitespace-nowrap ${
                activeCategory === cat ? "bg-white text-black shadow-lg" : "text-zinc-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="p-5 max-w-md mx-auto space-y-10 text-left">
        {/* TABLE SELECTION */}
        <section className="space-y-5">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em]">Table Number</h2>
            {tableNum && (
              <button 
                onClick={() => { haptic(); setIsBillOpen(true); }}
                className="text-xs font-black text-orange-800 bg-orange-100 px-5 py-2.5 rounded-full border-2 border-orange-200 transition-all active:scale-95 shadow-sm"
              >
                お会計・履歴
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: tableCount }, (_, i) => i + 1).map((num) => {
              const hasOrder = allOrders.some(o => o.tableNumber === num && o.status !== "checked_out");
              const isSelected = tableNum === num;
              return (
                <button
                  key={num}
                  onClick={() => { haptic(); setTableNum(num); }}
                  className={`aspect-square rounded-[1.25rem] font-black text-sm transition-all border-2 relative flex items-center justify-center ${
                    isSelected 
                    ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-xl scale-105" 
                    : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <span className="break-all px-1 leading-tight">{getTableName(num)}</span>
                  {hasOrder && (
                    <span className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white ${isSelected ? "bg-orange-400" : "bg-orange-600"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* MENU GRID */}
        <section className="space-y-5">
          <h2 className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em] px-1">{activeCategory}</h2>
          <div className="grid grid-cols-2 gap-5">
            {menus.filter(m => m.category === activeCategory).map((item) => (
              <button
                key={item.id}
                onClick={() => handleOpenOptions(item)}
                className={`p-5 rounded-[1.75rem] border-2 text-left min-h-[110px] flex flex-col justify-between transition-all bg-white shadow-md active:scale-[0.97] ${
                  item.isAvailable ? "border-zinc-100 border-b-zinc-200" : "opacity-30 grayscale border-transparent"
                }`}
              >
                <p className="font-black text-[15px] leading-snug text-[#1a1a1a]">{item.name}</p>
                <p className="text-[15px] font-bold text-zinc-600 mt-2">¥{item.price.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* BILL MODAL */}
      {isBillOpen && tableNum && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 text-left">
          <div className="bg-[#fdfcfb] w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl border border-white animate-in zoom-in-95 duration-200">
            <div className="bg-[#1a1a1a] p-8 text-white text-center relative">
              <button onClick={() => setIsBillOpen(false)} className="absolute top-6 right-6 text-3xl font-light text-zinc-400">×</button>
              <p className="text-[10px] tracking-[0.3em] font-bold text-zinc-400 mb-1 uppercase">Order Status</p>
              <h2 className="text-2xl font-serif italic mb-2 text-zinc-100">{getTableName(tableNum)}</h2>
              <div className="h-1.5 w-12 bg-orange-600 mx-auto rounded-full" />
            </div>
            
            <div className="p-8 space-y-10">
              <div className="text-center">
                <p className="text-xs font-black text-zinc-500 uppercase mb-2 tracking-widest text-center">現在の合計金額</p>
                <p className="text-6xl font-bold text-[#1a1a1a] text-center">¥{currentTableTotal.toLocaleString()}</p>
              </div>

              <div className="space-y-4 max-h-72 overflow-y-auto custom-scrollbar border-y-2 border-zinc-100 py-6">
                {currentTableOrders.length > 0 ? (
                  currentTableOrders.flatMap(o => o.items).map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-1">
                      <div className="flex flex-col">
                        <span className="font-black text-zinc-800 text-[15px]">{item.name}</span>
                        {item.quantity > 1 && <span className="text-xs text-orange-700 font-bold mt-0.5">数量: {item.quantity}</span>}
                      </div>
                      <span className="font-bold text-lg text-zinc-600">¥{(item.totalPrice * item.quantity).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-zinc-400 italic py-10 font-bold text-center">注文履歴がありません</p>
                )}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleCheckout}
                  disabled={currentTableOrders.length === 0}
                  className="w-full py-5 rounded-2xl font-black text-lg bg-orange-700 text-white shadow-xl disabled:bg-zinc-200 disabled:text-zinc-400 transition-all active:scale-95 shadow-orange-900/20"
                >
                  お会計を完了する
                </button>
                <button onClick={() => setIsBillOpen(false)} className="w-full py-2 text-zinc-500 text-sm font-black tracking-widest hover:text-zinc-800 text-center">入力画面に戻る</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER CART */}
      <div className="fixed bottom-0 w-full p-6 bg-white/90 backdrop-blur-2xl border-t-2 border-zinc-200 z-20 shadow-[0_-15px_50px_rgba(0,0,0,0.08)]">
        <div className="max-w-md mx-auto space-y-5 text-left">
          <div className="flex justify-between items-center px-1">
            <span className="text-[11px] font-black text-zinc-600 uppercase tracking-widest">追加注文リスト</span>
            <span className="text-lg font-bold text-orange-800">
              小計: ¥{cart.reduce((s, i) => s + (i.totalPrice * i.quantity), 0).toLocaleString()}
            </span>
          </div>

          {cart.length > 0 && (
            <div className="max-h-36 overflow-y-auto space-y-2.5 no-scrollbar py-1">
              {cart.map((c, i) => (
                <div key={i} className="flex justify-between items-center bg-[#fdfcfb] p-4 rounded-2xl border-2 border-zinc-100 shadow-sm animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-5">
                    <button 
                      onClick={() => removeFromCart(i)} 
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all border border-red-100 active:scale-90 shadow-sm"
                    >
                      <span className="text-2xl font-light leading-none">×</span>
                    </button>
                    <div>
                      <p className="text-sm font-black text-zinc-800">{c.name}</p>
                      {c.quantity > 1 && <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">数量: {c.quantity}</span>}
                    </div>
                  </div>
                  <span className="text-[15px] font-bold text-zinc-700">¥{(c.totalPrice * c.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleOrderSubmit}
            disabled={!tableNum || cart.length === 0 || isSubmitting}
            className={`w-full py-5 rounded-[2.25rem] font-black text-base tracking-[0.1em] shadow-2xl transition-all active:scale-95 ${
              !tableNum || cart.length === 0 
              ? "bg-zinc-200 text-zinc-500 shadow-none" 
              : "bg-[#1a1a1a] text-white shadow-zinc-900/40"
            }`}
          >
            {!tableNum ? "テーブルを選択してください" : isSubmitting ? "送信中..." : `注文を確定する`}
          </button>
        </div>
      </div>

      {/* OPTIONS MODAL */}
      {optionPopupItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end text-left">
          <div className="bg-[#fdfcfb] w-full rounded-t-[3.5rem] p-10 shadow-2xl max-h-[85vh] overflow-y-auto border-t-2 border-white animate-in slide-in-from-bottom duration-300">
            <div className="max-w-md mx-auto text-left">
              <div className="flex justify-between items-start mb-12">
                <div className="text-left space-y-1">
                  <h2 className="text-2xl font-black text-zinc-900">{optionPopupItem.name}</h2>
                  <p className="text-lg text-zinc-500 font-bold">¥{optionPopupItem.price.toLocaleString()}</p>
                </div>
                <button onClick={() => setOptionPopupItem(null)} className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center text-2xl text-zinc-500 active:bg-zinc-200">×</button>
              </div>

              <div className="space-y-12 pb-12">
                {optionPopupItem.hasSpicyOption && (
                  <div className="space-y-5 text-left">
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">🌶 辛さレベル</p>
                    <div className="flex gap-3">
                      {["無し", "小", "中", "大"].map(lv => (
                        <button key={lv} onClick={() => { haptic(); setSelectedSpicy(lv); }} className={`flex-1 py-4.5 rounded-2xl text-sm font-black border-2 transition-all ${selectedSpicy === lv ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-lg" : "bg-white text-zinc-600 border-zinc-200"}`}>{lv}</button>
                      ))}
                    </div>
                  </div>
                )}
                
                {optionPopupItem.hasCorianderOption && (
                  <div className="space-y-5 text-left">
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">🌿 パクチー</p>
                    <div className="flex gap-3">
                      {["有り", "無し"].map(opt => (
                        <button key={opt} onClick={() => { haptic(); setSelectedCoriander(opt); }} className={`flex-1 py-4.5 rounded-2xl text-sm font-black border-2 transition-all ${selectedCoriander === opt ? "bg-green-800 text-white border-green-800 shadow-lg" : "bg-white text-zinc-600 border-zinc-200"}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                )}

                {optionPopupItem.toppings && optionPopupItem.toppings.length > 0 && (
                  <div className="space-y-5 text-left">
                    <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">トッピング</p>
                    <div className="space-y-3">
                      {optionPopupItem.toppings?.map(t => (
                        <button
                          key={t.name}
                          onClick={() => { haptic(); setSelectedToppings(p => p.find(s => s.name === t.name) ? p.filter(x => x.name !== t.name) : [...p, t]); }}
                          className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all font-black text-[15px] ${
                            selectedToppings.find(s => s.name === t.name) 
                            ? "bg-zinc-50 border-zinc-900 text-zinc-900 shadow-md" 
                            : "bg-white border-zinc-100 text-zinc-500"
                          }`}
                        >
                          <span>{t.name}</span>
                          <span className="font-bold text-zinc-800">+¥{t.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  value={userMemo}
                  onChange={e => setUserMemo(e.target.value)}
                  placeholder="アレルギーや抜き物のご希望があれば..."
                  className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-[2rem] p-6 text-[15px] font-bold h-32 outline-none focus:border-zinc-300 transition-all placeholder:font-normal placeholder:text-zinc-400"
                />
                
                <button
                  onClick={addToCart}
                  className="w-full bg-[#1a1a1a] text-white py-6 rounded-[2.5rem] font-black text-lg tracking-[0.15em] shadow-xl active:scale-[0.98] transition-all"
                >
                  カートに追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}