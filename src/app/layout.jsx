import '@/styles/globals.scss';

export const metadata = {
  title: 'ScreenAI',
  description: 'Скриншот и анализ через Google AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: '100vh' }}>{children}</body>
    </html>
  );
}
