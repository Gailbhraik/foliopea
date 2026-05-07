import './globals.css';
export const metadata = { title: 'FolioPEA', description: 'Dashboard PEA - Next.js' };
export default function RootLayout({ children }) {
  return <html lang="fr"><body style={{ margin: 0, padding: 0, background: '#0b0f1a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif" }}>{children}</body></html>;
}
