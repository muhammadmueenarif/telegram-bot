"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, getDocs, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Users, DollarSign, Package, Clock } from "lucide-react";

export default function Dashboard() {
    const [stats, setStats] = useState({
        todayStars: 0,
        weekStars: 0,
        monthStars: 0,
        totalUsers: 0,
        totalContent: 0,
    });
    const [topUsers, setTopUsers] = useState([]);
    const [topContent, setTopContent] = useState([]);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // Get date ranges
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            // Get transactions
            const transactionsRef = collection(db, "transactions");
            const transactionsSnap = await getDocs(transactionsRef);
            const allTransactions = transactionsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
            }));

            // Calculate Stars by period
            const todayStars = allTransactions
                .filter(t => t.timestamp >= todayStart)
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            
            const weekStars = allTransactions
                .filter(t => t.timestamp >= weekStart)
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            
            const monthStars = allTransactions
                .filter(t => t.timestamp >= monthStart)
                .reduce((sum, t) => sum + (t.amount || 0), 0);

            // Get users
            const usersRef = collection(db, "users");
            const usersSnap = await getDocs(usersRef);
            const allUsers = usersSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                joinedAt: doc.data().joinedAt?.toDate?.() || new Date(doc.data().joinedAt)
            }));

            // Get top paying users
            const topPayingUsers = allUsers
                .filter(u => u.totalSpent > 0)
                .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
                .slice(0, 5);

            // Get content
            const contentRef = collection(db, "content");
            const contentSnap = await getDocs(contentRef);
            const allContent = contentSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Get top content (by sales count if available, otherwise by price)
            const topSoldContent = allContent
                .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
                .slice(0, 5);

            // Get recent transactions
            const recent = allTransactions
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);

            setStats({
                todayStars,
                weekStars,
                monthStars,
                totalUsers: allUsers.length,
                totalContent: allContent.length,
            });
            setTopUsers(topPayingUsers);
            setTopContent(topSoldContent);
            setRecentTransactions(recent);
            setLoading(false);
        } catch (error) {
            console.error("Error loading dashboard:", error);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading dashboard...</div>
            </div>
        );
    }

  return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <button
                    onClick={loadDashboardData}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Today's Stars</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.todayStars}</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">This Week</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.weekStars}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">This Month</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.monthStars}</p>
                        </div>
                        <Clock className="w-8 h-8 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Users</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                        </div>
                        <Users className="w-8 h-8 text-indigo-500" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Paying Users */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Top Paying Users</h2>
                    <div className="space-y-3">
                        {topUsers.length > 0 ? (
                            topUsers.map((user, index) => (
                                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {user.firstName || `User ${user.userId}`}
                                        </p>
                                        <p className="text-sm text-gray-500">@{user.username || "no username"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600">{user.totalSpent || 0} Stars</p>
                                        <p className="text-xs text-gray-500">#{index + 1}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-4">No paying users yet</p>
                        )}
                    </div>
                </div>

                {/* Most Sold Content */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Most Sold Content</h2>
                    <div className="space-y-3">
                        {topContent.length > 0 ? (
                            topContent.map((item, index) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <div>
                                        <p className="font-medium text-gray-900">{item.title || "Untitled"}</p>
                                        <p className="text-sm text-gray-500">{item.category || "No category"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600">{item.price || 0} Stars</p>
                                        <p className="text-xs text-gray-500">
                                            {item.salesCount || 0} sales
          </p>
        </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-4">No content yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Transactions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">User ID</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Payload</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTransactions.length > 0 ? (
                                recentTransactions.map((tx) => (
                                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4 text-sm text-gray-900">{tx.userId}</td>
                                        <td className="py-3 px-4 text-sm font-medium text-indigo-600">{tx.amount} Stars</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{tx.payload || "N/A"}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {tx.timestamp.toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-gray-500">
                                        No transactions yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
    </div>
  );
}
