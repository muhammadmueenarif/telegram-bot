import "./globals.css";
import AdminLayout from "./components/AdminLayout";
import { AuthProvider } from "./context/AuthContext";

export const metadata = {
  title: "Bot Admin",
  description: "Admin panel for Telegram Bot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <AdminLayout>{children}</AdminLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
