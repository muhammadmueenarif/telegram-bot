"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { MessageSquare, User, Bot, Search, Radio, Trash2 } from "lucide-react";

export default function ChatsPage() {
    const [allChats, setAllChats] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const chatEndRef = useRef(null);
    const chatsContainerRef = useRef(null);
    const usersMapRef = useRef({});
    const allChatsRef = useRef([]);
    const selectedUserIdRef = useRef(null);

    // Update refs when state changes
    useEffect(() => {
        usersMapRef.current = usersMap;
    }, [usersMap]);

    useEffect(() => {
        allChatsRef.current = allChats;
    }, [allChats]);

    useEffect(() => {
        selectedUserIdRef.current = selectedUserId;
    }, [selectedUserId]);

    // Real-time listener for chats
    useEffect(() => {
        const chatsRef = collection(db, "chats");
        
        // Use simple query without orderBy to avoid index issues, we'll sort in JS
        const unsubscribeChats = onSnapshot(chatsRef, (snapshot) => {
            const chats = snapshot.docs.map(doc => {
                const data = doc.data();
                let timestamp;
                
                // Handle different timestamp formats
                if (data.timestamp) {
                    // Firestore Timestamp object (has toDate method)
                    if (data.timestamp.toDate && typeof data.timestamp.toDate === 'function') {
                        timestamp = data.timestamp.toDate();
                    } 
                    // Already a Date object
                    else if (data.timestamp instanceof Date) {
                        timestamp = data.timestamp;
                    } 
                    // String date
                    else if (typeof data.timestamp === 'string') {
                        timestamp = new Date(data.timestamp);
                    } 
                    // Firestore Timestamp with seconds property
                    else if (data.timestamp.seconds) {
                        timestamp = new Date(data.timestamp.seconds * 1000);
                    } 
                    // Number (milliseconds)
                    else if (typeof data.timestamp === 'number') {
                        timestamp = new Date(data.timestamp);
                    } 
                    else {
                        timestamp = new Date();
                    }
                } else {
                    // Fallback to current time if no timestamp
                    timestamp = new Date();
                }
                
                return {
                    id: doc.id,
                    userId: data.userId,
                    role: data.role,
                    content: data.content,
                    timestamp: timestamp
                };
            });

            // Sort by timestamp descending (newest first)
            chats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            console.log(`✅ Loaded ${chats.length} chats from Firebase`);
            setAllChats(chats);
            allChatsRef.current = chats;
            updateUsersList(chats, usersMapRef.current);
            setLoading(false);

            // Auto-scroll to bottom if viewing the conversation that got a new message
            if (selectedUserIdRef.current && chats.some(c => c.userId === selectedUserIdRef.current)) {
                setTimeout(() => {
                    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
            }
        }, (error) => {
            console.error("❌ Error listening to chats:", error);
            setLoading(false);
        });

        return () => unsubscribeChats();
    }, []);

    // Real-time listener for users
    useEffect(() => {
        const usersRef = collection(db, "users");
        
        const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
            const newUsersMap = {};
            snapshot.docs.forEach(doc => {
                const userData = doc.data();
                newUsersMap[userData.userId] = {
                    userId: userData.userId,
                    firstName: userData.firstName,
                    username: userData.username,
                };
            });

            setUsersMap(newUsersMap);
            usersMapRef.current = newUsersMap;
            updateUsersList(allChatsRef.current, newUsersMap);
        }, (error) => {
            console.error("Error listening to users:", error);
        });

        return () => unsubscribeUsers();
    }, []);

    const updateUsersList = (chats, usersMapData) => {
        // Get unique user IDs
        const uniqueUserIds = [...new Set(chats.map(chat => chat.userId))];

        // Create user list with chat info
        const usersList = uniqueUserIds.map(userId => {
            const userChats = chats.filter(c => c.userId === userId);
            const lastChat = userChats[0]; // Most recent
            return {
                userId: userId,
                firstName: usersMapData[userId]?.firstName || `User ${userId}`,
                username: usersMapData[userId]?.username || "no username",
                messageCount: userChats.length,
                lastMessage: lastChat?.content || "",
                lastMessageTime: lastChat?.timestamp || new Date(),
            };
        }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        setUsers(usersList);
    };

    const getUserChats = (userId) => {
        return allChats
            .filter(chat => chat.userId === userId)
            .sort((a, b) => a.timestamp - b.timestamp);
    };

    const handleDeleteChat = async () => {
        if (!selectedUserId) return;
        
        setDeleting(true);
        try {
            // Get all chat documents for this user
            const chatsRef = collection(db, "chats");
            const userChatsQuery = query(chatsRef, where("userId", "==", selectedUserId));
            const snapshot = await getDocs(userChatsQuery);
            
            // Delete all chat documents
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            console.log(`✅ Deleted ${snapshot.docs.length} chat messages for user ${selectedUserId}`);
            
            // Clear selected user
            setSelectedUserId(null);
            setShowDeleteConfirm(false);
            
            alert(`Successfully deleted ${snapshot.docs.length} chat messages!`);
        } catch (error) {
            console.error("Error deleting chats:", error);
            alert("Error deleting chats: " + error.message);
        } finally {
            setDeleting(false);
        }
    };

    const selectedUser = users.find(u => u.userId === selectedUserId);
    const userChats = selectedUserId ? getUserChats(selectedUserId) : [];

    const filteredUsers = users.filter(user =>
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userId?.toString().includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading chats...</div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-4">
            {/* Users List */}
            <div className="w-80 bg-white rounded-lg border border-gray-200 flex flex-col shadow-sm">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-blue-100">
                            <MessageSquare className="w-5 h-5" style={{ color: '#0088CC' }} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">All Users</h2>
                        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 border border-green-200">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-green-700">Live</span>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                        />
                    </div>
                    {filteredUsers.length > 0 && (
                        <p className="text-xs text-gray-500 mt-3">
                            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
                        </p>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {filteredUsers.map((user) => (
                                <button
                                    key={user.userId}
                                    onClick={() => setSelectedUserId(user.userId)}
                                    className={`w-full text-left p-4 transition-all duration-200 ${
                                        selectedUserId === user.userId 
                                            ? "bg-blue-50 border-l-4 border-blue-500 shadow-sm" 
                                            : "hover:bg-gray-50 border-l-4 border-transparent"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                                selectedUserId === user.userId 
                                                    ? "bg-blue-100 text-blue-600" 
                                                    : "bg-gray-100 text-gray-500"
                                            }`}>
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`font-semibold truncate ${
                                                        selectedUserId === user.userId 
                                                            ? "text-blue-900" 
                                                            : "text-gray-900"
                                                    }`}>
                                                        {user.firstName}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                selectedUserId === user.userId
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-gray-100 text-gray-600"
                                            }`}>
                                                {user.messageCount}
                                            </span>
                                        </div>
                                    </div>
                                    {user.lastMessage && (
                                        <p className={`text-sm truncate mb-2 ${
                                            selectedUserId === user.userId 
                                                ? "text-gray-700" 
                                                : "text-gray-600"
                                        }`}>
                                            {user.lastMessage}
                                        </p>
                                    )}
                                    <p className={`text-xs ${
                                        selectedUserId === user.userId 
                                            ? "text-blue-600" 
                                            : "text-gray-400"
                                    }`}>
                                        {user.lastMessageTime.toLocaleString('en-US', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                        })}
                                    </p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <Search className="w-12 h-12 text-gray-300" />
                                <p className="text-gray-500 font-medium">No users found</p>
                                <p className="text-sm text-gray-400">Try adjusting your search</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat View */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col">
                {selectedUserId ? (
                    <>
                        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {selectedUser?.firstName || `User ${selectedUserId}`}
                                            </h3>
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 border border-green-200">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                <span className="text-xs font-medium text-green-700">Live</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600">@{selectedUser?.username || "no username"}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {userChats.length}
                                            </span>
                                            <span className="text-xs text-gray-500">messages</span>
                                        </div>
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors"
                                            disabled={deleting}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-sm font-medium">Delete Chat</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">ID: {selectedUserId}</p>
                                </div>
                            </div>
                        </div>
                        <div 
                            ref={chatsContainerRef}
                            className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
                        >
                            {userChats.length > 0 ? (
                                <>
                                    {userChats.map((chat) => (
                                        <div
                                            key={chat.id}
                                            className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
                                                    chat.role === "user"
                                                        ? "text-white"
                                                        : "bg-white text-gray-900 border border-gray-200"
                                                }`}
                                                style={chat.role === "user" ? { backgroundColor: '#0088CC' } : {}}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    {chat.role === "user" ? (
                                                        <User className="w-4 h-4 opacity-90" />
                                                    ) : (
                                                        <Bot className="w-4 h-4 text-gray-600" />
                                                    )}
                                                    <span className={`text-xs font-semibold ${
                                                        chat.role === "user" ? "opacity-90" : "text-gray-600"
                                                    }`}>
                                                        {chat.role === "user" ? "User" : "Bot"}
                                                    </span>
                                                </div>
                                                
                                                {/* Show media if exists */}
                                                {chat.fileUrl && (
                                                    <div className="mb-2 rounded-lg overflow-hidden">
                                                        {chat.mediaType === "video" || chat.type === "video" ? (
                                                            <video
                                                                src={chat.fileUrl}
                                                                className="w-full max-w-md rounded-lg"
                                                                controls
                                                            />
                                                        ) : (
                                                            <img
                                                                src={chat.fileUrl}
                                                                alt={chat.content || "Media"}
                                                                className="w-full max-w-md rounded-lg object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {chat.content && (
                                                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                        {chat.content}
                                                    </p>
                                                )}
                                                <p className={`text-xs mt-2 ${
                                                    chat.role === "user" ? "text-white opacity-75" : "text-gray-400"
                                                }`}>
                                                    {chat.timestamp.toLocaleString('en-US', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="flex flex-col items-center gap-2">
                                        <MessageSquare className="w-12 h-12 text-gray-300" />
                                        <p className="text-gray-500 font-medium">No messages found for this user</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="text-center max-w-md px-6">
                            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-10 h-10 text-blue-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No conversation selected</h3>
                            <p className="text-gray-500">Select a user from the list to view their chat history</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    style={{ backgroundColor: '#00000078' }}
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div 
                        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border border-gray-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Chat</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete all chat messages for <strong>{selectedUser?.firstName || `User ${selectedUserId}`}</strong>? 
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteChat}
                                className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2"
                                style={{ backgroundColor: '#0088CC' }}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

