"use client";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const success = login(email, password);
        if (!success) {
            setError("Invalid email or password");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold" style={{ color: '#0088CC' }}>
                            Bot Admin
                        </h1>
                        <p className="text-gray-500 mt-2 text-sm">Sign in to access admin panel</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@gmail.com"
                                required
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
                                style={{ focusRingColor: '#0088CC' }}
                                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0088CC40'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
                                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #0088CC40'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            style={{ backgroundColor: '#0088CC' }}
                            onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#0077BB')}
                            onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#0088CC')}
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
