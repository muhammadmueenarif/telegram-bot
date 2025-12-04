"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { Plus, Trash2, Edit, X, Star } from "lucide-react";

export default function PackagesManagement() {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        stars: "",
        price: "",
        currency: "USD",
        includes: "",
        order: "",
    });

    const currencies = ["USD", "EUR", "GBP", "JPY", "CNY", "INR"];

    useEffect(() => {
        loadPackages();
    }, []);

    const loadPackages = async () => {
        try {
            const packagesRef = collection(db, "packages");
            const q = query(packagesRef, orderBy("order", "asc"));
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPackages(items);
            setLoading(false);
        } catch (error) {
            console.error("Error loading packages:", error);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const packageData = {
                stars: parseInt(formData.stars) || 0,
                price: parseFloat(formData.price) || 0,
                currency: formData.currency,
                includes: formData.includes || "",
                order: parseInt(formData.order) || packages.length,
                createdAt: editingItem?.createdAt || new Date(),
                updatedAt: new Date(),
            };

            if (editingItem) {
                // Update existing
                await updateDoc(doc(db, "packages", editingItem.id), packageData);
            } else {
                // Create new
                await addDoc(collection(db, "packages"), packageData);
            }

            setShowModal(false);
            setFormData({ stars: "", price: "", currency: "USD", includes: "", order: "" });
            setEditingItem(null);
            loadPackages();
        } catch (error) {
            console.error("Error saving package:", error);
            alert("Error saving package: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this package?")) return;

        try {
            await deleteDoc(doc(db, "packages", id));
            loadPackages();
        } catch (error) {
            console.error("Error deleting package:", error);
            alert("Error deleting package: " + error.message);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            stars: item.stars?.toString() || "",
            price: item.price?.toString() || "",
            currency: item.currency || "USD",
            includes: item.includes || "",
            order: item.order?.toString() || "",
        });
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Star Packages</h1>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setFormData({ stars: "", price: "", currency: "USD", includes: "", order: "" });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                    style={{ backgroundColor: '#0088CC' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#0077BB'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#0088CC'}
                >
                    <Plus className="w-5 h-5" />
                    Add Package
                </button>
            </div>

            {/* Packages List */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading packages...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map((pkg) => (
                        <div key={pkg.id} className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Star className="w-6 h-6" style={{ color: '#0088CC' }} />
                                    <span className="text-2xl font-bold text-gray-900">
                                        {pkg.stars?.toLocaleString() || 0}
                                    </span>
                                    <span className="text-gray-500">Stars</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold" style={{ color: '#0088CC' }}>
                                        {pkg.currency}{pkg.price?.toFixed(2) || "0.00"}
                                    </div>
                                </div>
                            </div>

                            {pkg.includes && (
                                <div className="mb-4">
                                    <p className="text-sm text-gray-600">{pkg.includes}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                                <span>Order: {pkg.order || 0}</span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(pkg)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(pkg.id)}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {packages.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500">
                    No packages yet. Click "Add Package" to get started.
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000078' }}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingItem ? "Edit Package" : "Add Package"}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    setEditingItem(null);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Stars Amount *
                                </label>
                                <input
                                    type="number"
                                    value={formData.stars}
                                    onChange={(e) => setFormData({ ...formData, stars: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                        onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                        min="0"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Currency *
                                    </label>
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                        onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                        required
                                    >
                                        {currencies.map((curr) => (
                                            <option key={curr} value={curr}>{curr}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Includes (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.includes}
                                    onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    placeholder="e.g., Bonus 10 stars, Premium access"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display Order *
                                </label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    min="0"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Lower numbers appear first in the mini app
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingItem(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50"
                                    style={{ backgroundColor: '#0088CC' }}
                                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#0077BB')}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0088CC'}
                                >
                                    {saving ? "Saving..." : editingItem ? "Update" : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
