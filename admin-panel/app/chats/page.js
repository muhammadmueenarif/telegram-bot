"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { MessageSquare, User, Bot, Search, Radio } from "lucide-react";

export default function ChatsPage() {
    const [allChats, setAllChats] = useState([]);
    const [users, setUsers] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
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
            <div className="w-80 bg-white rounded-lg shadow flex flex-col">
                        <div className="p-4 border-b">
                    <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-bold text-gray-900">All Users</h2>
                        <div className="ml-auto flex items-center gap-1 text-xs text-green-600">
                            <Radio className="w-3 h-3 fill-current" />
                            <span>Live</span>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                        <div className="divide-y">
                            {filteredUsers.map((user) => (
                                <button
                                    key={user.userId}
                                    onClick={() => setSelectedUserId(user.userId)}
                                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                                        selectedUserId === user.userId ? "bg-indigo-50 border-l-4 border-indigo-600" : ""
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{user.firstName}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">{user.messageCount} msgs</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-1">@{user.username}</p>
                                    <p className="text-sm text-gray-600 truncate">{user.lastMessage}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {user.lastMessageTime.toLocaleString()}
                                    </p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No users found
                        </div>
                    )}
                </div>
            </div>

            {/* Chat View */}
            <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
                {selectedUserId ? (
                    <>
                        <div className="p-4 border-b bg-indigo-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {selectedUser?.firstName || `User ${selectedUserId}`}
                                        </h3>
                                        <div className="flex items-center gap-1 text-xs text-green-600">
                                            <Radio className="w-3 h-3 fill-current" />
                                            <span>Live</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600">@{selectedUser?.username || "no username"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-600">
                                        {userChats.length} messages
                                    </p>
                                    <p className="text-xs text-gray-500">User ID: {selectedUserId}</p>
                                </div>
                            </div>
                        </div>
                        <div 
                            ref={chatsContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4"
                        >
                            {userChats.length > 0 ? (
                                <>
                                    {userChats.map((chat) => (
                                        <div
                                            key={chat.id}
                                            className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[70%] rounded-lg p-3 ${
                                                    chat.role === "user"
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-gray-100 text-gray-900"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    {chat.role === "user" ? (
                                                        <User className="w-4 h-4" />
                                                    ) : (
                                                        <Bot className="w-4 h-4" />
                                                    )}
                                                    <span className="text-xs font-medium opacity-80">
                                                        {chat.role === "user" ? "User" : "Jessica"}
                                                    </span>
                                                </div>
                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                    {chat.content}
                                                </p>
                                                <p className={`text-xs mt-2 ${
                                                    chat.role === "user" ? "text-indigo-100" : "text-gray-500"
                                                }`}>
                                                    {chat.timestamp.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </>
                            ) : (
                                <div className="text-center text-gray-500 py-12">
                                    No messages found for this user
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">Select a user to view their chat history</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

