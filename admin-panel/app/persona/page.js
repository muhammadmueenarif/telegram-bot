"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Save, User, MessageSquare, FileText } from "lucide-react";

export default function PersonaPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [persona, setPersona] = useState({
        name: "Jessica",
        age: "23",
        prompt: `You are Jessica, a 23-year-old flirty and sweet girl.

How you talk:
- Casual and natural, like texting a boyfriend
- Use emojis sometimes but not too many
- Be warm, playful, and a little teasing
- Keep responses short (1-3 sentences usually)
- Sometimes use "babe", "hun", "cutie"
- Show interest in the person, ask questions back
- Be a bit mysterious and intriguing

Rules:
- NEVER admit you're AI or a bot
- NEVER break character
- If asked if you're real, playfully dodge or say "of course I'm real silly 😘"
- You sell exclusive photos/videos for Telegram Stars (mention naturally when appropriate)
- Remember what user told you in the conversation`,
        bio: "A fun-loving, flirty girl who loves connecting with people and sharing exclusive content.",
    });

    useEffect(() => {
        loadPersona();
    }, []);

    const loadPersona = async () => {
        try {
            const personaRef = doc(db, "settings", "persona");
            const personaSnap = await getDoc(personaRef);
            
            if (personaSnap.exists()) {
                const data = personaSnap.data();
                setPersona({
                    name: data.name || "Jessica",
                    age: data.age || "23",
                    prompt: data.prompt || persona.prompt,
                    bio: data.bio || persona.bio,
                });
            }
            setLoading(false);
        } catch (error) {
            console.error("Error loading persona:", error);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const personaRef = doc(db, "settings", "persona");
            await setDoc(personaRef, {
                name: persona.name,
                age: persona.age,
                prompt: persona.prompt,
                bio: persona.bio,
                updatedAt: new Date(),
            });
            alert("Persona saved successfully!");
        } catch (error) {
            console.error("Error saving persona:", error);
            alert("Error saving persona: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading persona...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">AI Persona Settings</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                    <Save className="w-5 h-5" />
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <User className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={persona.name}
                                onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Age
                            </label>
                            <input
                                type="text"
                                value={persona.age}
                                onChange={(e) => setPersona({ ...persona, age: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Bio / Backstory
                            </label>
                            <textarea
                                value={persona.bio}
                                onChange={(e) => setPersona({ ...persona, bio: e.target.value })}
                                rows="4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="Describe Jessica's personality and backstory..."
                            />
                        </div>
                    </div>
                </div>

                {/* Personality Prompt */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <MessageSquare className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-xl font-bold text-gray-900">Personality Prompt</h2>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            System Prompt (How Jessica talks and behaves)
                        </label>
                        <textarea
                            value={persona.prompt}
                            onChange={(e) => setPersona({ ...persona, prompt: e.target.value })}
                            rows="20"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                            placeholder="Enter the system prompt that defines Jessica's personality..."
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            This prompt is sent to OpenAI to define how Jessica responds to users.
                        </p>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-gray-900">Preview</h2>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold">Name:</span> {persona.name}
                        </p>
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold">Age:</span> {persona.age}
                        </p>
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold">Bio:</span> {persona.bio}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

