"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Image as ImageIcon,
    Settings,
    Users,
    Video,
    MessageSquare,
    Menu,
    X,
    Star
} from "lucide-react";

export default function AdminLayout({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const pathname = usePathname();

    const navItems = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Content", href: "/content", icon: ImageIcon },
        { name: "Packages", href: "/packages", icon: Star },
        { name: "Persona", href: "/persona", icon: Settings },
        { name: "Users", href: "/users", icon: Users },
        { name: "Chats", href: "/chats", icon: MessageSquare }
    ];

    return (
        <div className="min-h-screen bg-white flex">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    } lg:relative lg:translate-x-0`}
            >
                <div className="h-16 flex items-center justify-between px-6">
                    <h1 className="text-xl font-bold" style={{ color: '#0088CC' }}>Admin</h1>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <nav className="p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? "text-white"
                                        : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                style={isActive ? { backgroundColor: '#0088CC' } : {}}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-white" : "text-gray-400"}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
                <header className="bg-white h-16 flex items-center px-6 lg:hidden">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-gray-500">
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="ml-4 text-lg font-semibold text-gray-900">Admin Panel</h1>
                </header>

                <main className="flex-1 overflow-y-auto p-6 bg-white">
                    {children}
                </main>
            </div>
        </div>
    );
}
