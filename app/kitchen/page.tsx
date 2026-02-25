"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

type OrderItem = {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  options?: { spicy?: string; coriander?: string; selectedToppings?: any[]; memo?: string; };
};

type Order = {
  id: string;
  tableNumber: number;
  tableName?: string;
  items: OrderItem[];
  status: "preparing" | "completed";
  createdAt: any;
};

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"preparing" | "completed">("preparing");
  const prevOrderCount = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const allOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[];
      const activeOrders = allOrders.filter((o) => o.status === "preparing");
      if (activeOrders.length > prevOrderCount.current && prevOrderCount.current !== 0) {
        new Audio("https://actions.google.com/sounds/v1/alarms/ding.ogg").play().catch(() => {});
      }
      prevOrderCount.current = activeOrders.length;
      setOrders(allOrders);
    });
    return () => unsubscribe();
  }, []);

  const getCardColor = (createdAt: any) => {
    if (!createdAt) return "bg-white border-gray-200";
    const diff = Math.floor((now.getTime() - createdAt.toMillis()) / 60000);
    if (diff >= 20) return "bg-red-50 border-red-500 shadow-red-100";
    if (diff >= 15) return "bg-yellow-50 border-yellow-400 shadow-yellow-100";
    return "bg-white border-gray-200";
  };

  const markAsCompleted = async (id: string) => { await updateDoc(doc(db, "orders", id), { status: "completed" }); };

  const displayOrders = orders
    .filter((o) => o.status === activeTab)
    .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

  return (
    <div className="min-h-screen bg-gray-200 p-4 font-sans text-gray-900">
      <div className="flex justify-between items-center mb-4 max-w-6xl mx-auto">
        <h1 className="text-xl font-black bg-white px-4 py-2 rounded-lg shadow-sm">🍳 KITCHEN</h1>
        <div className="flex gap-2 text-xs">
          {["preparing", "completed"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 rounded-lg font-black transition-all ${activeTab === tab ? "bg-black text-white shadow-lg" : "bg-white text-gray-400"}`}>
              {tab === "preparing" ? "調理中" : "履歴"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start max-w-6xl mx-auto">
        {displayOrders.map((order) => (
          <div key={order.id} className={`border-t-8 rounded-xl overflow-hidden shadow-md flex flex-col ${getCardColor(order.createdAt)}`}>
            <div className="p-3 border-b flex justify-between items-center bg-white/30 text-left">
              <span className="text-3xl font-black">{order.tableName || `#${order.tableNumber}`}</span>
              <span className="text-xl font-black">⏱ {order.createdAt ? Math.floor((now.getTime() - order.createdAt.toMillis()) / 60000) : 0}分</span>
            </div>
            <div className="p-2 space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="bg-white/70 p-3 rounded-lg text-left shadow-sm">
                  <div className="flex justify-between font-black"><span>{item.name}</span><span>×{item.quantity}</span></div>
                  <div className="mt-1 space-y-1">
                    {item.options?.spicy && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold italic block w-fit">🌶 {item.options.spicy}</span>}
                    {item.options?.selectedToppings && item.options.selectedToppings.length > 0 && <div className="text-blue-700 text-xs font-black italic">+ {item.options.selectedToppings.map((t: any) => t.name || t).join(", ")}</div>}
                    {item.options?.memo && <div className="bg-orange-100 text-orange-800 p-2 rounded text-sm font-bold border-l-4 border-orange-500">🚩 {item.options.memo}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2">
              <button onClick={() => markAsCompleted(order.id)} className="w-full bg-blue-600 text-white font-black py-4 rounded-lg text-xl shadow-lg">提供済み</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}