'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/settings/settings.module.scss';

export default function SettingsPage() {
  const [shortcut, setShortcut] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron?.getShortcut) {
      window.electron.getShortcut().then((acc) => setShortcut(acc || ''));
    }
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!window.electron?.setShortcut) {
      setError('Запустите приложение через Electron');
      return;
    }
    const acc = shortcut.trim();
    if (!acc) {
      setError('Введите комбинацию клавиш');
      return;
    }
    const ok = await window.electron.setShortcut(acc);
    if (ok) {
      setSaved(true);
    } else {
      setError('Не удалось зарегистрировать комбинацию. Пример: Ctrl+Home');
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Настройки</h1>
        <Link href="/" className={styles.back}>Назад</Link>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Горячие клавиши</h2>
        <p className={styles.hint}>
          Комбинация для скриншота и анализа. Формат: Ctrl+Home, Ctrl+Shift+S и т.д.
        </p>
        <form onSubmit={handleSave} className={styles.form}>
          <input
            type="text"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="Ctrl+Home"
            className={styles.input}
          />
          <button type="submit" className={styles.button}>Сохранить</button>
        </form>
        {saved && <p className={styles.success}>Сохранено.</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>
    </main>
  );
}
