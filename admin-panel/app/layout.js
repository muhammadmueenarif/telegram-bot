import "./globals.css";
import AdminLayout from "./components/AdminLayout";

export const metadata = {
  title: "Bot Admin",
  description: "Admin panel for Telegram Bot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
