"use client";
import { useState, useEffect } from "react";
import { db, storage } from "../../lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Plus, Trash2, Edit, Image as ImageIcon, Video, X } from "lucide-react";

export default function ContentManagement() {
    const [content, setContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "",
        price: "",
        type: "photo",
        file: null,
        isFree: false,
    });
    const [categories, setCategories] = useState(["Spicy", "Lingerie", "Exclusive", "Custom"]);

    useEffect(() => {
        loadContent();
    }, []);

    const loadContent = async () => {
        try {
            const contentRef = collection(db, "content");
            const snapshot = await getDocs(contentRef);
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setContent(items);
            setLoading(false);
        } catch (error) {
            console.error("Error loading content:", error);
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, file, type: file.type.startsWith("video") ? "video" : "photo" });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.file && !editingItem) {
            alert("Please select a file");
            return;
        }

        setUploading(true);
        try {
            let fileUrl = editingItem?.fileUrl || "";

            // Upload file if new
            if (formData.file) {
                const fileRef = ref(storage, `content/${Date.now()}_${formData.file.name}`);
                await uploadBytes(fileRef, formData.file);
                fileUrl = await getDownloadURL(fileRef);
            }

            const contentData = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                price: formData.isFree ? 0 : parseInt(formData.price) || 0,
                isFree: formData.isFree,
                type: formData.type,
                fileUrl: fileUrl,
                createdAt: editingItem?.createdAt || new Date(),
                updatedAt: new Date(),
            };

            if (editingItem) {
                // Update existing
                await updateDoc(doc(db, "content", editingItem.id), contentData);
            } else {
                // Create new
                await addDoc(collection(db, "content"), {
                    ...contentData,
                    salesCount: 0,
                });
            }

            setShowModal(false);
            setFormData({ title: "", description: "", category: "", price: "", type: "photo", file: null, isFree: false });
            setEditingItem(null);
            loadContent();
        } catch (error) {
            console.error("Error saving content:", error);
            alert("Error saving content: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, fileUrl) => {
        if (!confirm("Are you sure you want to delete this content?")) return;

        try {
            // Delete from Firestore
            await deleteDoc(doc(db, "content", id));

            // Delete from Storage
            if (fileUrl) {
                try {
                    const fileRef = ref(storage, fileUrl);
                    await deleteObject(fileRef);
                } catch (storageError) {
                    console.error("Error deleting file from storage:", storageError);
                }
            }

            loadContent();
        } catch (error) {
            console.error("Error deleting content:", error);
            alert("Error deleting content: " + error.message);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            title: item.title || "",
            description: item.description || "",
            category: item.category || "",
            price: item.price?.toString() || "",
            type: item.type || "photo",
            file: null,
            isFree: item.isFree || false,
        });
        setShowModal(true);
    };

    const addCategory = () => {
        const newCategory = prompt("Enter new category name:");
        if (newCategory && !categories.includes(newCategory)) {
            setCategories([...categories, newCategory]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Content Management</h1>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setFormData({ title: "", description: "", category: "", price: "", type: "photo", file: null, isFree: false });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                    style={{ backgroundColor: '#0088CC' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#0077BB'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#0088CC'}
                >
                    <Plus className="w-5 h-5" />
                    Upload Content
                </button>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
                    <button
                        onClick={addCategory}
                        className="text-sm"
                        style={{ color: '#0088CC' }}
                        onMouseEnter={(e) => e.target.style.color = '#0077BB'}
                        onMouseLeave={(e) => e.target.style.color = '#0088CC'}
                    >
                        + Add Category
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                        <span
                            key={cat}
                            className="px-3 py-1 rounded-full text-sm"
                            style={{ backgroundColor: '#E6F4F9', color: '#0088CC' }}
                        >
                            {cat}
                        </span>
                    ))}
                </div>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading content...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {content.map((item) => (
                        <div key={item.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="relative aspect-square bg-gray-100">
                                {item.type === "video" ? (
                                    <video
                                        src={item.fileUrl}
                                        className="w-full h-full object-cover"
                                        controls
                                    />
                                ) : (
                                    <img
                                        src={item.fileUrl}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                                <div className="absolute top-2 right-2">
                                    {item.type === "video" ? (
                                        <Video className="w-6 h-6 text-white bg-black bg-opacity-50 rounded p-1" />
                                    ) : (
                                        <ImageIcon className="w-6 h-6 text-white bg-black bg-opacity-50 rounded p-1" />
                                    )}
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-semibold text-gray-900 mb-1">{item.title || "Untitled"}</h3>
                                {item.description && (
                                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                                )}
                                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{item.category || "Uncategorized"}</span>
                                    <div className="flex items-center gap-2">
                                        {item.isFree ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">FREE</span>
                                        ) : (
                                            <span className="font-bold text-sm" style={{ color: '#0088CC' }}>{item.price || 0} ⭐</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id, item.fileUrl)}
                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {content.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500">
                    No content yet. Click "Upload Content" to get started.
                </div>
            )}

            {/* Upload/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000078' }}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingItem ? "Edit Content" : "Upload Content"}
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
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    style={{ focusOutlineColor: '#0088CC' }}
                                    placeholder="e.g., Beach Sunset Photo"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description <span className="text-red-500">*</span>
                                    <span className="text-xs text-gray-500 ml-2">(Help AI understand this content)</span>
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                                    style={{ focusOutlineColor: '#0088CC' }}
                                    rows="3"
                                    placeholder="e.g., Beautiful beach sunset photo, perfect for beach lovers, tropical vibes, ocean view, golden hour"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    💡 Be descriptive! Include keywords like: beach, workout, lingerie, custom, exclusive, etc.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    required
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pricing
                                </label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            id="free-content"
                                            name="pricing-content"
                                            checked={formData.isFree}
                                            onChange={() => setFormData({ ...formData, isFree: true, price: 0 })}
                                            className="w-4 h-4"
                                            style={{ accentColor: '#0088CC' }}
                                        />
                                        <label htmlFor="free-content" className="text-sm text-gray-700 cursor-pointer">
                                            Free
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            id="paid-content"
                                            name="pricing-content"
                                            checked={!formData.isFree}
                                            onChange={() => setFormData({ ...formData, isFree: false })}
                                            className="w-4 h-4"
                                            style={{ accentColor: '#0088CC' }}
                                        />
                                        <label htmlFor="paid-content" className="text-sm text-gray-700 cursor-pointer">
                                            Paid
                                        </label>
                                    </div>
                                    {!formData.isFree && (
                                        <div className="ml-7">
                                            <label className="block text-xs text-gray-600 mb-1">
                                                Price (Stars)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                                onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                                min="1"
                                                required={!formData.isFree}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {editingItem ? "Current File" : "File (Photo/Video)"}
                                </label>
                                {editingItem && (
                                    <div className="mb-2">
                                        {editingItem.type === "video" ? (
                                            <video src={editingItem.fileUrl} className="w-full rounded" controls />
                                        ) : (
                                            <img src={editingItem.fileUrl} alt={editingItem.title} className="w-full rounded" />
                                        )}
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    required={!editingItem}
                                />
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
                                    disabled={uploading}
                                    className="flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50"
                                    style={{ backgroundColor: '#0088CC' }}
                                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#0077BB')}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0088CC'}
                                >
                                    {uploading ? "Uploading..." : editingItem ? "Update" : "Upload"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

