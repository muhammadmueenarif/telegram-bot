import './globals.css'

export const metadata = {
  title: 'Telegrams AI Bot',
  description: 'Telegrams AI Bot Application',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

