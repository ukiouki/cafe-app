"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { QRCodeSVG } from "qrcode.react";

type Topping = { name: string; price: number };

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
  hasSpicyOption: boolean;
  hasCorianderOption: boolean;
  toppings: Topping[];
};

// 注文データの型定義
type OrderItem = {
  name: string;
  totalPrice: number;
  quantity: number;
  options?: {
    spicy?: string;
    selectedToppings?: { name: string }[];
  };
};

type Order = {
  id: string;
  tableNumber: number;
  items: OrderItem[];
  totalPrice: number;
  status: string;
};

export default function AdminPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number | "">("");
  const [newCategory, setNewCategory] = useState("アペタイザー");
  
  const [hasSpicy, setHasSpicy] = useState(false);
  const [hasCoriander, setHasCoriander] = useState(false);
  
  const [topName, setTopName] = useState("");
  const [topPrice, setTopPrice] = useState<number | "">("");
  const [tempToppings, setTempToppings] = useState<Topping[]>([]);

  const [tableNames, setTableNames] = useState<{ [key: number]: string }>({});
  const [tableCount, setTableCount] = useState(8);
  const [selectedTable, setSelectedTable] = useState(1);
  const [editingTableName, setEditingTableName] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  // ★注文履歴用の状態
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubMenu = onSnapshot(collection(db, "menus"), (snapshot) => {
      setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuItem[]);
    });

    const unsubTables = onSnapshot(doc(db, "settings", "tables"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTableCount(data.count || 8);
        setTableNames(data.names || {});
      }
    });

    // ★全注文をリアルタイム取得
    const unsubOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
      setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    });

    return () => { unsubMenu(); unsubTables(); unsubOrders(); };
  }, []);

  useEffect(() => {
    const baseUrl = window.location.origin;
    setQrUrl(`${baseUrl}?table=${selectedTable}`);
    setEditingTableName(tableNames[selectedTable] || `TABLE ${selectedTable}`);
  }, [selectedTable, tableNames]);

  // ★選択中のテーブルの注文のみ抽出
  const currentTableOrders = allOrders.filter(o => o.tableNumber === selectedTable && o.status !== "checked_out");
  const currentTableTotal = currentTableOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);

  const addTempTopping = () => {
    if (!topName || topPrice === "") return;
    setTempToppings([...tempToppings, { name: topName, price: Number(topPrice) }]);
    setTopName(""); setTopPrice("");
  };

  const removeTempTopping = (index: number) => {
    setTempToppings(tempToppings.filter((_, i) => i !== index));
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || newPrice === "") return;
    await addDoc(collection(db, "menus"), {
      name: newName, price: Number(newPrice), category: newCategory,
      isAvailable: true, hasSpicyOption: hasSpicy, hasCorianderOption: hasCoriander,
      toppings: tempToppings,
    });
    setNewName(""); setNewPrice(""); setHasSpicy(false); setHasCoriander(false); setTempToppings([]);
  };

  const saveTableCount = async (newCount: number) => {
    await setDoc(doc(db, "settings", "tables"), { count: newCount }, { merge: true });
  };

  const saveTableName = async () => {
    const newNames = { ...tableNames, [selectedTable]: editingTableName };
    await setDoc(doc(db, "settings", "tables"), { names: newNames }, { merge: true });
    alert(`${selectedTable}番の設定を更新しました`);
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "menus", id), { isAvailable: !current });
  };

  const deleteMenu = async (id: string) => {
    if (confirm("削除しますか？")) await deleteDoc(doc(db, "menus", id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800 pb-20 text-left">
      <h1 className="text-3xl font-black mb-8 border-l-8 border-black pl-4 uppercase tracking-tighter">Admin Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* メニュー登録セクション */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 italic text-gray-400">🍴 メニュー新規登録</h2>
            <form onSubmit={handleAddMenu} className="space-y-4">
              <div className="space-y-3">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full border-2 rounded-xl p-3 focus:border-black outline-none" placeholder="商品名" />
                <div className="flex gap-2">
                  <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))} className="flex-1 border-2 rounded-xl p-3 focus:border-black outline-none" placeholder="価格" />
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="flex-1 border-2 rounded-xl p-3 bg-white outline-none">
                    <option>アペタイザー</option><option>ハンバーガー</option><option>ドリンク</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl space-y-4 border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Options & Toppings</p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-sm"><input type="checkbox" checked={hasSpicy} onChange={e => setHasSpicy(e.target.checked)} className="accent-black" /> 辛さ</label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-sm"><input type="checkbox" checked={hasCoriander} onChange={e => setHasCoriander(e.target.checked)} className="accent-black" /> パクチー</label>
                </div>

                <div className="pt-2 space-y-2 border-t border-gray-200">
                  <div className="flex gap-2">
                    <input type="text" value={topName} onChange={e => setTopName(e.target.value)} className="flex-[2] border p-2 rounded-lg text-sm outline-none" placeholder="ﾄｯﾋﾟﾝｸﾞ名" />
                    <input type="number" value={topPrice} onChange={e => setTopPrice(e.target.value === "" ? "" : Number(e.target.value))} className="flex-1 border p-2 rounded-lg text-sm outline-none" placeholder="¥" />
                    <button type="button" onClick={addTempTopping} className="bg-zinc-800 text-white px-3 rounded-lg text-xs font-bold">追加</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tempToppings.map((t, i) => (
                      <span key={i} className="bg-white border px-3 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-2">
                        {t.name}(+¥{t.price})
                        <button type="button" onClick={() => removeTempTopping(i)} className="text-red-500 font-black">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button className="w-full bg-black text-white font-black py-4 rounded-2xl shadow-lg hover:bg-zinc-800 active:scale-95 transition-all">メニューを保存</button>
            </form>
          </section>

          {/* メニュー一覧 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">メニュー管理</h2>
            <div className="divide-y divide-gray-100">
              {menus.map(item => (
                <div key={item.id} className="flex items-center justify-between py-4 group">
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-gray-400 font-bold">¥{item.price} {item.toppings?.length > 0 && `(＋ﾄｯﾋﾟﾝｸﾞ${item.toppings.length}種)`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleAvailability(item.id, item.isAvailable)} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${item.isAvailable ? "bg-green-500 text-white shadow-md shadow-green-100" : "bg-gray-200 text-gray-500"}`}>
                      {item.isAvailable ? "販売中" : "売切中"}
                    </button>
                    <button onClick={() => deleteMenu(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all text-xs">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 右側：テーブル設定 ＋ 注文状況 */}
        <div className="space-y-6">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 sticky top-8 text-center">
            <h2 className="text-xl font-black mb-6 text-left italic underline decoration-yellow-400">TABLE SETTINGS</h2>
            
            {/* 注文合計金額の表示 */}
            <div className="bg-blue-600 text-white p-6 rounded-2xl mb-6 shadow-lg shadow-blue-100 flex justify-between items-center">
              <div className="text-left">
                <p className="text-[10px] font-black uppercase opacity-60">Selected Table Total</p>
                <p className="text-3xl font-black">¥{currentTableTotal.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase opacity-60">Status</p>
                <p className="font-bold">{currentTableOrders.length > 0 ? "注文あり" : "空席"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-zinc-900 text-white p-4 rounded-2xl mb-8">
              <span className="font-black text-sm">稼働テーブル数</span>
              <div className="flex items-center gap-4">
                <button onClick={() => { const c = Math.max(1, tableCount - 1); setTableCount(c); saveTableCount(c); }} className="w-10 h-10 bg-zinc-800 rounded-full font-black">-</button>
                <span className="text-2xl font-black w-8 text-center">{tableCount}</span>
                <button onClick={() => { const c = tableCount + 1; setTableCount(c); saveTableCount(c); }} className="w-10 h-10 bg-zinc-800 rounded-full font-black">+</button>
              </div>
            </div>

            <div className="flex justify-start gap-1 mb-6 flex-wrap">
              {Array.from({ length: tableCount }, (_, i) => i + 1).map((num) => {
                const hasOrder = allOrders.some(o => o.tableNumber === num && o.status !== "checked_out");
                return (
                  <button
                    key={num}
                    onClick={() => setSelectedTable(num)}
                    className={`w-10 h-10 rounded-lg font-black transition-all relative ${
                      selectedTable === num ? "bg-black text-white shadow-lg scale-110" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {num}
                    {hasOrder && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></span>}
                  </button>
                );
              })}
            </div>

            {/* 注文詳細リスト */}
            {currentTableOrders.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-2xl mb-8 text-left border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Current Order Details</p>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {currentTableOrders.map((order) => (
                    <div key={order.id} className="border-b border-gray-200 pb-2 last:border-0">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm mb-1">
                          <div>
                            <p className="font-bold">{item.name} <span className="text-gray-400">×{item.quantity}</span></p>
                            <div className="text-[10px] text-blue-500">
                              {item.options?.selectedToppings?.map(t => `+${t.name}`).join(" ")}
                            </div>
                          </div>
                          <p className="font-bold">¥{item.totalPrice?.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-6 rounded-2xl mb-8 border border-gray-100 text-left">
              <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-widest">Table Name Display</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={editingTableName}
                  onChange={(e) => setEditingTableName(e.target.value)}
                  className="flex-1 border-2 rounded-xl p-3 font-bold focus:border-black outline-none transition-all"
                  placeholder="例: テラス席-1"
                />
                <button onClick={saveTableName} className="bg-blue-600 text-white px-6 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all">更新</button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] inline-block border-2 border-gray-100 mb-6 shadow-sm">
              <QRCodeSVG value={qrUrl} size={150} />
              <p className="mt-4 font-black text-2xl tracking-tighter">{tableNames[selectedTable] || `TABLE ${selectedTable}`}</p>
            </div>
            
            <button onClick={() => window.print()} className="w-full bg-gray-100 text-gray-800 font-black py-4 rounded-2xl border-2 border-gray-200 hover:bg-gray-200 transition-all">この画面を印刷する</button>
          </section>
        </div>
      </div>
    </div>
  );
}