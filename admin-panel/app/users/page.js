"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { Ban, CheckCircle, Search, DollarSign } from "lucide-react";

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterBlocked, setFilterBlocked] = useState("all");

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const usersRef = collection(db, "users");
            const snapshot = await getDocs(usersRef);
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                joinedAt: doc.data().joinedAt?.toDate?.() || new Date(doc.data().joinedAt),
            }));
            setUsers(usersList);
            setLoading(false);
        } catch (error) {
            console.error("Error loading users:", error);
            setLoading(false);
        }
    };

    const toggleBlock = async (userId, currentStatus) => {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                blocked: !currentStatus,
                updatedAt: new Date(),
            });
            loadUsers();
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Error updating user: " + error.message);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = 
            user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.userId?.toString().includes(searchTerm);
        
        const matchesFilter = 
            filterBlocked === "all" ||
            (filterBlocked === "blocked" && user.blocked) ||
            (filterBlocked === "active" && !user.blocked);

        return matchesSearch && matchesFilter;
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading users...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                <button
                    onClick={loadUsers}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600">Blocked Users</p>
                    <p className="text-2xl font-bold text-red-600">
                        {users.filter(u => u.blocked).length}
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                        {users.reduce((sum, u) => sum + (u.totalSpent || 0), 0)} Stars
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by name, username, or user ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select
                        value={filterBlocked}
                        onChange={(e) => setFilterBlocked(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">All Users</option>
                        <option value="active">Active Only</option>
                        <option value="blocked">Blocked Only</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">User</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">User ID</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Joined</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Total Spent</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedUsers.length > 0 ? (
                                sortedUsers.map((user) => (
                                    <tr key={user.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium text-gray-900">{user.firstName || "Unknown"}</p>
                                                <p className="text-sm text-gray-500">@{user.username || "no username"}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{user.userId}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {user.joinedAt.toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="w-4 h-4 text-green-500" />
                                                <span className="font-medium text-gray-900">{user.totalSpent || 0}</span>
                                                <span className="text-sm text-gray-500">Stars</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {user.blocked ? (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                                                    Blocked
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={() => toggleBlock(user.id, user.blocked)}
                                                className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-medium ${
                                                    user.blocked
                                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                        : "bg-red-100 text-red-700 hover:bg-red-200"
                                                }`}
                                            >
                                                {user.blocked ? (
                                                    <>
                                                        <CheckCircle className="w-4 h-4" />
                                                        Unblock
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ban className="w-4 h-4" />
                                                        Block
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-gray-500">
                                        No users found
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

