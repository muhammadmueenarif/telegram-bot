"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext();

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "adminbot2233";

export function AuthProvider({ children }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const auth = localStorage.getItem("admin_auth");
        if (auth === "true") {
            setIsLoggedIn(true);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!isLoading) {
            if (!isLoggedIn && pathname !== "/login") {
                router.push("/login");
            }
            if (isLoggedIn && pathname === "/login") {
                router.push("/");
            }
        }
    }, [isLoggedIn, isLoading, pathname, router]);

    const login = (email, password) => {
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            setIsLoggedIn(true);
            localStorage.setItem("admin_auth", "true");
            router.push("/");
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem("admin_auth");
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
