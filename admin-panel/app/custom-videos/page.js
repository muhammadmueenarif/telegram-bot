"use client";
import { useState, useEffect } from "react";
import { db, storage } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, getDoc, setDoc, query, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Plus, Upload, Video, CheckCircle, Clock, DollarSign } from "lucide-react";

export default function CustomVideosPage() {
    const [baseVideos, setBaseVideos] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [customVideoPrice, setCustomVideoPrice] = useState(100);
    const [formData, setFormData] = useState({
        title: "",
        file: null,
        isFree: false,
        price: 0,
    });

    useEffect(() => {
        loadData();
        loadSettings();
        
        // Real-time listener for custom video requests
        const requestsRef = collection(db, "custom_video_requests");
        const unsubscribeRequests = onSnapshot(requestsRef, () => {
            loadData(); // Reload when requests change
        });

        // Real-time listener for pricing
        const pricingRef = doc(db, "settings", "pricing");
        const unsubscribePricing = onSnapshot(pricingRef, (doc) => {
            if (doc.exists()) {
                setCustomVideoPrice(doc.data().customVideoPrice || 100);
            }
        });

        return () => {
            unsubscribeRequests();
            unsubscribePricing();
        };
    }, []);

    const loadData = async () => {
        try {
            // Load base videos
            const baseVideosRef = collection(db, "base_videos");
            const baseVideosSnap = await getDocs(baseVideosRef);
            const videos = baseVideosSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBaseVideos(videos);

            // Load users for user info
            const usersRef = collection(db, "users");
            const usersSnap = await getDocs(usersRef);
            const usersMap = {};
            usersSnap.docs.forEach(doc => {
                const userData = doc.data();
                usersMap[userData.userId] = {
                    firstName: userData.firstName,
                    username: userData.username,
                };
            });

            // Load custom video requests
            const requestsRef = collection(db, "custom_video_requests");
            const requestsSnap = await getDocs(requestsRef);
            const requestsList = requestsSnap.docs.map(doc => {
                const data = doc.data();
                const userInfo = usersMap[data.userId] || {};
                
                // Handle timestamp conversion
                let createdAt, completedAt, paidAt;
                if (data.createdAt) {
                    createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
                } else {
                    createdAt = new Date();
                }
                if (data.completedAt) {
                    completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
                }
                if (data.paidAt) {
                    paidAt = data.paidAt?.toDate?.() || new Date(data.paidAt);
                }
                
                return {
                    id: doc.id,
                    ...data,
                    createdAt: createdAt,
                    completedAt: completedAt,
                    paidAt: paidAt,
                    userName: userInfo.firstName || `User ${data.userId}`,
                    userUsername: userInfo.username || "no username",
                };
            });
            setRequests(requestsList);
            setLoading(false);
        } catch (error) {
            console.error("Error loading data:", error);
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const settingsRef = doc(db, "settings", "pricing");
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                setCustomVideoPrice(settingsSnap.data().customVideoPrice || 100);
            }
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith("video")) {
            setFormData({ ...formData, file });
        } else {
            alert("Please select a video file");
        }
    };

    const handleUploadBaseVideo = async (e) => {
        e.preventDefault();
        if (!formData.file) {
            alert("Please select a video file");
            return;
        }

        setUploading(true);
        try {
            const fileRef = ref(storage, `base_videos/${Date.now()}_${formData.file.name}`);
            await uploadBytes(fileRef, formData.file);
            const fileUrl = await getDownloadURL(fileRef);

            await addDoc(collection(db, "base_videos"), {
                title: formData.title,
                fileUrl: fileUrl,
                isFree: formData.isFree,
                price: formData.isFree ? 0 : parseInt(formData.price) || 0,
                createdAt: new Date(),
            });

            setShowUploadModal(false);
            setFormData({ title: "", file: null, isFree: false, price: 0 });
            loadData();
        } catch (error) {
            console.error("Error uploading base video:", error);
            alert("Error uploading video: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSavePrice = async () => {
        try {
            const settingsRef = doc(db, "settings", "pricing");
            await setDoc(settingsRef, {
                customVideoPrice: parseInt(customVideoPrice),
                updatedAt: new Date(),
            }, { merge: true });
            alert("Price saved successfully!");
        } catch (error) {
            console.error("Error saving price:", error);
            alert("Error saving price: " + error.message);
        }
    };

    const markAsCompleted = async (requestId) => {
        try {
            const requestRef = doc(db, "custom_video_requests", requestId);
            await updateDoc(requestRef, {
                status: "completed",
                completedAt: new Date(),
            });
            loadData();
        } catch (error) {
            console.error("Error updating request:", error);
            alert("Error updating request: " + error.message);
        }
    };

    const pendingRequests = requests.filter(r => r.status !== "completed" && r.status !== "paid").sort((a, b) => b.createdAt - a.createdAt);
    const paidRequests = requests.filter(r => r.status === "paid").sort((a, b) => (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt));
    const completedRequests = requests.filter(r => r.status === "completed").sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Custom Videos</h1>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                    style={{ backgroundColor: '#0088CC' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#0077BB'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#0088CC'}
                >
                    <Plus className="w-5 h-5" />
                    Upload Base Video
                </button>
            </div>

            {/* Price Setting */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Custom Video Price</h2>
                        <p className="text-sm text-gray-600">Set the price for custom video requests</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={customVideoPrice}
                                onChange={(e) => setCustomVideoPrice(e.target.value)}
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                min="1"
                            />
                            <span className="text-gray-700">Stars</span>
                        </div>
                        <button
                            onClick={handleSavePrice}
                            className="px-4 py-2 text-white rounded-lg"
                            style={{ backgroundColor: '#0088CC' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#0077BB'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#0088CC'}
                        >
                            Save Price
                        </button>
                    </div>
                </div>
            </div>

            {/* Base Videos */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Base Video Clips</h2>
                {baseVideos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {baseVideos.map((video) => (
                            <div key={video.id} className="rounded-lg overflow-hidden border border-gray-200">
                                <video
                                    src={video.fileUrl}
                                    className="w-full aspect-video object-cover"
                                    controls
                                />
                                <div className="p-3">
                                    <p className="font-medium text-gray-900">{video.title || "Untitled"}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        {video.isFree ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">FREE</span>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#E6F4F9', color: '#0088CC' }}>
                                                {video.price || 0} Stars
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No base videos uploaded yet</p>
                )}
            </div>

            {/* Paid Requests (Need Processing) */}
            {paidRequests.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Paid Requests (Ready to Process)</h2>
                        <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: '#E6F4F9', color: '#0088CC' }}>
                            {paidRequests.length}
                        </span>
                    </div>
                    <div className="space-y-4">
                        {paidRequests.map((request) => (
                            <div key={request.id} className="rounded-lg p-4 border border-gray-200" style={{ backgroundColor: '#E6F4F9' }}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="w-5 h-5" style={{ color: '#0088CC' }} />
                                            <span className="font-medium text-gray-900">Request #{request.id.slice(0, 8)}</span>
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">PAID</span>
                                        </div>
                                        <div className="mb-2">
                                            <p className="text-sm font-medium text-gray-900">{request.userName}</p>
                                            <p className="text-xs text-gray-500">@{request.userUsername} • ID: {request.userId}</p>
                                        </div>
                                        {request.message && (
                                            <p className="text-sm text-gray-600 mb-1">
                                                <span className="font-medium">Request:</span> {request.message}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-sm">
                                            <p className="text-gray-600">
                                                <span className="font-medium">Price:</span> {request.price || request.amount || customVideoPrice} Stars
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Paid: {request.paidAt?.toLocaleString() || request.createdAt.toLocaleString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => markAsCompleted(request.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Mark Complete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Requests (Not Paid Yet) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Pending Requests</h2>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        {pendingRequests.length}
                    </span>
                </div>
                {pendingRequests.length > 0 ? (
                    <div className="space-y-4">
                        {pendingRequests.map((request) => (
                            <div key={request.id} className="rounded-lg p-4 border border-gray-200">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-5 h-5 text-yellow-500" />
                                            <span className="font-medium text-gray-900">Request #{request.id.slice(0, 8)}</span>
                                        </div>
                                        <div className="mb-2">
                                            <p className="text-sm font-medium text-gray-900">{request.userName}</p>
                                            <p className="text-xs text-gray-500">@{request.userUsername} • ID: {request.userId}</p>
                                        </div>
                                        {request.message && (
                                            <p className="text-sm text-gray-600 mb-1">
                                                <span className="font-medium">Request:</span> {request.message}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-sm">
                                            <p className="text-gray-600">
                                                <span className="font-medium">Price:</span> {request.price || request.amount || customVideoPrice} Stars
                                            </p>
                                            <p className="text-gray-500">
                                                {request.status === "paid" ? "✅ Paid" : request.status === "completed" ? "✅ Completed" : "⏳ Pending"}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Requested: {request.createdAt.toLocaleString()}
                                            {request.paidAt && ` • Paid: ${request.paidAt.toLocaleString()}`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => markAsCompleted(request.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Mark Complete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No pending requests</p>
                )}
            </div>

            {/* Completed Videos */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Completed Videos</h2>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {completedRequests.length}
                    </span>
                </div>
                {completedRequests.length > 0 ? (
                    <div className="space-y-4">
                        {completedRequests.map((request) => (
                            <div key={request.id} className="rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="font-medium text-gray-900">Request #{request.id.slice(0, 8)}</span>
                                </div>
                                <div className="mb-2">
                                    <p className="text-sm font-medium text-gray-900">{request.userName}</p>
                                    <p className="text-xs text-gray-500">@{request.userUsername} • ID: {request.userId}</p>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                    <span className="font-medium">Price:</span> {request.price || request.amount || customVideoPrice} Stars
                                </p>
                                {request.completedVideoUrl && (
                                    <div className="mt-3">
                                        <video
                                            src={request.completedVideoUrl}
                                            className="w-full max-w-md rounded"
                                            controls
                                        />
                                    </div>
                                )}
                                <p className="text-sm text-gray-500 mt-2">
                                    Completed: {request.completedAt?.toLocaleString() || "N/A"}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No completed videos yet</p>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#00000078' }}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Base Video</h2>
                        <form onSubmit={handleUploadBaseVideo} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Video File
                                </label>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                                    onFocus={(e) => e.target.style.outlineColor = '#0088CC'}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pricing
                                </label>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            id="free"
                                            name="pricing"
                                            checked={formData.isFree}
                                            onChange={() => setFormData({ ...formData, isFree: true, price: 0 })}
                                            className="w-4 h-4"
                                            style={{ accentColor: '#0088CC' }}
                                        />
                                        <label htmlFor="free" className="text-sm text-gray-700 cursor-pointer">
                                            Free
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            id="paid"
                                            name="pricing"
                                            checked={!formData.isFree}
                                            onChange={() => setFormData({ ...formData, isFree: false })}
                                            className="w-4 h-4"
                                            style={{ accentColor: '#0088CC' }}
                                        />
                                        <label htmlFor="paid" className="text-sm text-gray-700 cursor-pointer">
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
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        setFormData({ title: "", file: null, isFree: false, price: 0 });
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
                                    {uploading ? "Uploading..." : "Upload"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

