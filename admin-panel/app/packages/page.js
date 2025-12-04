"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { Plus, Trash2, Edit, X, Star, Image as ImageIcon, Video, Check } from "lucide-react";

export default function PackagesManagement() {
    const [packages, setPackages] = useState([]);
    const [content, setContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        stars: "",
        includes: "",
        order: "",
        contentIds: [],
    });

    useEffect(() => {
        loadPackages();
        loadContent();
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

    const loadContent = async () => {
        try {
            const contentRef = collection(db, "content");
            const snapshot = await getDocs(contentRef);
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setContent(items);
        } catch (error) {
            console.error("Error loading content:", error);
        }
    };

    const toggleContentSelection = (contentId) => {
        setFormData(prev => ({
            ...prev,
            contentIds: prev.contentIds.includes(contentId)
                ? prev.contentIds.filter(id => id !== contentId)
                : [...prev.contentIds, contentId]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const packageData = {
                stars: parseInt(formData.stars) || 0,
                includes: formData.includes || "",
                order: parseInt(formData.order) || packages.length,
                contentIds: formData.contentIds || [],
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
            setFormData({ stars: "", includes: "", order: "", contentIds: [] });
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
            includes: item.includes || "",
            order: item.order?.toString() || "",
            contentIds: item.contentIds || [],
        });
        setShowModal(true);
    };

    const getPackageContent = (pkg) => {
        if (!pkg.contentIds || pkg.contentIds.length === 0) return [];
        return content.filter(c => pkg.contentIds.includes(c.id));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Star Packages</h1>
                    <p className="text-sm text-gray-600 mt-1">Create packages with selected content that users get after payment</p>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setFormData({ stars: "", includes: "", order: "", contentIds: [] });
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
                    {packages.map((pkg) => {
                        const packageContent = getPackageContent(pkg);
                        return (
                            <div key={pkg.id} className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Star className="w-8 h-8" style={{ color: '#FFD700' }} fill="#FFD700" />
                                    <span className="text-3xl font-bold text-gray-900">
                                        {pkg.stars?.toLocaleString() || 0}
                                    </span>
                                    <span className="text-xl text-gray-500">Stars</span>
                                </div>

                                {pkg.includes && (
                                    <div className="mb-3">
                                        <p className="text-sm text-gray-600">{pkg.includes}</p>
                                    </div>
                                )}

                                {/* Package Content Preview */}
                                <div className="mb-4">
                                    <div className="text-xs font-medium text-gray-700 mb-2">
                                        Includes {packageContent.length} {packageContent.length === 1 ? 'item' : 'items'}:
                                    </div>
                                    {packageContent.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {packageContent.slice(0, 4).map(item => (
                                                <div key={item.id} className="relative w-12 h-12 rounded overflow-hidden border border-gray-200">
                                                    {item.type === 'video' ? (
                                                        <video src={item.fileUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={item.fileUrl} alt={item.title} className="w-full h-full object-cover" />
                                                    )}
                                                    <div className="absolute top-0 right-0 bg-black bg-opacity-50 rounded-bl px-1">
                                                        {item.type === 'video' ? (
                                                            <Video className="w-3 h-3 text-white" />
                                                        ) : (
                                                            <ImageIcon className="w-3 h-3 text-white" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {packageContent.length > 4 && (
                                                <div className="w-12 h-12 rounded border border-gray-200 flex items-center justify-center bg-gray-50">
                                                    <span className="text-xs text-gray-600">+{packageContent.length - 4}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic">No content selected</p>
                                    )}
                                </div>

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
                        );
                    })}
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
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingItem ? "Edit Package" : "Create Package"}
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

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Basic Info */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Stars Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={formData.stars}
                                    onChange={(e) => setFormData({ ...formData, stars: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    placeholder="e.g., 50, 100, 250"
                                    min="1"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Users will pay this amount in Telegram Stars
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Includes (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.includes}
                                        onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                        placeholder="e.g., 3 exclusive photos + bonus video"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Display Order <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.order}
                                        onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                        placeholder="0"
                                        min="0"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Lower numbers appear first
                                    </p>
                                </div>
                            </div>

                            {/* Content Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Content Items <span className="text-xs text-gray-500">({formData.contentIds.length} selected)</span>
                                </label>
                                <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                                    {content.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                            No content available. Upload content first in the Content section.
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {content.map((item) => {
                                                const isSelected = formData.contentIds.includes(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => toggleContentSelection(item.id)}
                                                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                                            isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <div className="aspect-square bg-gray-100">
                                                            {item.type === "video" ? (
                                                                <video
                                                                    src={item.fileUrl}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <img
                                                                    src={item.fileUrl}
                                                                    alt={item.title}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="absolute top-1 right-1">
                                                            {item.type === "video" ? (
                                                                <Video className="w-4 h-4 text-white bg-black bg-opacity-50 rounded p-0.5" />
                                                            ) : (
                                                                <ImageIcon className="w-4 h-4 text-white bg-black bg-opacity-50 rounded p-0.5" />
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                                                                <div className="bg-blue-500 rounded-full p-1">
                                                                    <Check className="w-5 h-5 text-white" />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                                                            <p className="text-xs text-white truncate">{item.title}</p>
                                                            {item.isFree ? (
                                                                <span className="text-xs text-green-300">FREE</span>
                                                            ) : (
                                                                <span className="text-xs text-yellow-300">{item.price} ⭐</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 Click on photos/videos to select them for this package. Selected items will be sent to users after they purchase this package.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
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
                                    {saving ? "Saving..." : editingItem ? "Update Package" : "Create Package"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
