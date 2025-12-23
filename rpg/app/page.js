"use client"
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-4">
      <div className="rpg-card text-center max-w-md">
        <h1 className="text-5xl text-amber-500 mb-6 font-serif">Reino de RPG</h1>
        <p className="text-stone-300 mb-8 italic">
          "Bem-vindo, viajante. O mural de missões e as lojas da cidade o aguardam."
        </p>
        <Link href="/login" className="rpg-btn text-xl px-8 py-4 inline-block">
          Entrar no Reino
        </Link>
      </div>
    </div>
  );
}