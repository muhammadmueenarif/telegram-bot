"use client";
import { useState, useEffect } from "react";
import { db, storage } from "../../lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, getDoc, setDoc, query, where } from "firebase/firestore";
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
    });

    useEffect(() => {
        loadData();
        loadSettings();
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

            // Load custom video requests
            const requestsRef = collection(db, "custom_video_requests");
            const requestsSnap = await getDocs(requestsRef);
            const requestsList = requestsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
                completedAt: doc.data().completedAt?.toDate?.() || (doc.data().completedAt ? new Date(doc.data().completedAt) : null),
            }));
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
                createdAt: new Date(),
            });

            setShowUploadModal(false);
            setFormData({ title: "", file: null });
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

    const pendingRequests = requests.filter(r => r.status !== "completed");
    const completedRequests = requests.filter(r => r.status === "completed");

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
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-5 h-5" />
                    Upload Base Video
                </button>
            </div>

            {/* Price Setting */}
            <div className="bg-white rounded-lg shadow p-6">
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
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                min="1"
                            />
                            <span className="text-gray-700">Stars</span>
                        </div>
                        <button
                            onClick={handleSavePrice}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Save Price
                        </button>
                    </div>
                </div>
            </div>

            {/* Base Videos */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Base Video Clips</h2>
                {baseVideos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {baseVideos.map((video) => (
                            <div key={video.id} className="border rounded-lg overflow-hidden">
                                <video
                                    src={video.fileUrl}
                                    className="w-full aspect-video object-cover"
                                    controls
                                />
                                <div className="p-3">
                                    <p className="font-medium text-gray-900">{video.title || "Untitled"}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No base videos uploaded yet</p>
                )}
            </div>

            {/* Pending Requests */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Pending Requests</h2>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        {pendingRequests.length}
                    </span>
                </div>
                {pendingRequests.length > 0 ? (
                    <div className="space-y-4">
                        {pendingRequests.map((request) => (
                            <div key={request.id} className="border rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-5 h-5 text-yellow-500" />
                                            <span className="font-medium text-gray-900">Request #{request.id.slice(0, 8)}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-1">
                                            <span className="font-medium">User ID:</span> {request.userId}
                                        </p>
                                        {request.message && (
                                            <p className="text-sm text-gray-600 mb-1">
                                                <span className="font-medium">Message:</span> {request.message}
                                            </p>
                                        )}
                                        <p className="text-sm text-gray-500">
                                            Requested: {request.createdAt.toLocaleString()}
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
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Completed Videos</h2>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {completedRequests.length}
                    </span>
                </div>
                {completedRequests.length > 0 ? (
                    <div className="space-y-4">
                        {completedRequests.map((request) => (
                            <div key={request.id} className="border rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="font-medium text-gray-900">Request #{request.id.slice(0, 8)}</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                    <span className="font-medium">User ID:</span> {request.userId}
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        setFormData({ title: "", file: null });
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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

