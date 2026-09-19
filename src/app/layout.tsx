import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'SensingWorks — チームで、未知をひらく。',
  description: 'Wi-FiセンシングPoCのミッション・週報・MID.予定を一つに。',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
