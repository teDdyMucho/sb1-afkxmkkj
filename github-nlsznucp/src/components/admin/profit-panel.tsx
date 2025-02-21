import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ProfitSummary {
  totalProfit: number;
  lucky2Profit: number;
  bingoProfit: number;
  versusProfit: number;
  todayProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
}

export function ProfitPanel() {
  const [profits, setProfits] = useState<ProfitSummary>({
    totalProfit: 0,
    lucky2Profit: 0,
    bingoProfit: 0,
    versusProfit: 0,
    todayProfit: 0,
    weeklyProfit: 0,
    monthlyProfit: 0
  });

  useEffect(() => {
    // Listen to profit transactions
    const profitsQuery = query(
      collection(db, 'transactions'),
      where('type', 'in', ['admin_profit'])
    );

    const unsubProfits = onSnapshot(profitsQuery, (snapshot) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalProfit = 0;
      let lucky2Profit = 0;
      let bingoProfit = 0;
      let versusProfit = 0;
      let todayProfit = 0;
      let weeklyProfit = 0;
      let monthlyProfit = 0;

      snapshot.docs.forEach(doc => {
        const transaction = doc.data();
        const amount = transaction.amount || 0;
        const timestamp = transaction.timestamp?.toDate() || new Date();
        const gameType = transaction.gameType || 'unknown';

        // Total profits by game type
        totalProfit += amount;
        if (gameType === 'lucky2') lucky2Profit += amount;
        if (gameType === 'bingo') bingoProfit += amount;
        if (gameType === 'versus') versusProfit += amount;

        // Time-based profits
        if (timestamp >= startOfDay) todayProfit += amount;
        if (timestamp >= startOfWeek) weeklyProfit += amount;
        if (timestamp >= startOfMonth) monthlyProfit += amount;
      });

      setProfits({
        totalProfit,
        lucky2Profit,
        bingoProfit,
        versusProfit,
        todayProfit,
        weeklyProfit,
        monthlyProfit
      });
    });

    return () => unsubProfits();
  }, []);

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-6 text-2xl font-bold">Profit Summary</h2>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Profit Card */}
        <div className="rounded-lg bg-green-50 p-4">
          <h3 className="text-lg font-semibold text-green-800">Total Profit</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            ₱{profits.totalProfit.toLocaleString()}
          </p>
        </div>

        {/* Today's Profit */}
        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="text-lg font-semibold text-blue-800">Today's Profit</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            ₱{profits.todayProfit.toLocaleString()}
          </p>
        </div>

        {/* Weekly Profit */}
        <div className="rounded-lg bg-purple-50 p-4">
          <h3 className="text-lg font-semibold text-purple-800">Weekly Profit</h3>
          <p className="mt-2 text-3xl font-bold text-purple-600">
            ₱{profits.weeklyProfit.toLocaleString()}
          </p>
        </div>

        {/* Game-specific Profits */}
        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Lucky2 Profit</h3>
          <p className="mt-2 text-2xl font-bold text-gray-700">
            ₱{profits.lucky2Profit.toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Bingo Profit</h3>
          <p className="mt-2 text-2xl font-bold text-gray-700">
            ₱{profits.bingoProfit.toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-semibold">Versus Profit</h3>
          <p className="mt-2 text-2xl font-bold text-gray-700">
            ₱{profits.versusProfit.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}