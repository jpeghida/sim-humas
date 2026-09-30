'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (username === 'admin_spit' && password === 'adminspit') {
      localStorage.setItem('sim_humas_logged_in', 'true')
      router.push('/')
    } else {
      setErrorMsg('Username atau Password salah! Gunakan kredensial resmi operator SPIT.')
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-950 text-slate-100 font-sans">
      
      {/* SISI KIRI: PANEL BRANDING POLRI (Logo, Gap, Posisi, & Subteks Sinkron) */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-slate-950 p-10 md:p-16 flex flex-col justify-center items-start relative overflow-hidden shadow-2xl pl-12 md:pl-20">
        
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Konten Ditarik ke Kiri dengan Flex Start & Gap Lebih Rapat */}
        <div className="relative z-10 flex items-center gap-5 w-full max-w-2xl">
          
          {/* Logo Diperbesar */}
          <img 
            src="/logo.png" 
            alt="Logo Polri Presisi" 
            className="h-40 md:h-52 w-auto object-contain flex-shrink-0 drop-shadow-2xl transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none'
            }}
          />

          {/* Blok Teks (Subteks Disamakan dengan Halaman Utama) */}
          <div className="space-y-3.5">
            <span className="inline-block bg-blue-500/30 text-blue-200 font-extrabold px-3 py-1 rounded-lg text-xs md:text-sm tracking-widest uppercase border border-blue-400/40 shadow-sm backdrop-blur-sm">
              SPIT PRESISI
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-[52px] font-black tracking-tight text-white drop-shadow-md leading-[1.05]">
              SIM-HUMAS <br />POLRES SUBANG
            </h1>
            <p className="text-blue-100 text-sm md:text-base font-medium leading-relaxed opacity-90 max-w-sm">
              Sistem Pengolahan & Penyusunan Informasi Rilis Berita Polres Subang.
            </p>
          </div>

        </div>
      </div>

      {/* SISI KANAN: FORMULIR AUTENTIKASI */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur">
          
          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Autentikasi Operator</h2>
            <p className="text-xs md:text-sm text-slate-400 mt-1">Masukkan akun resmi untuk mengakses sistem.</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Username / ID Operator
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-600 font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm tracking-wider uppercase py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition duration-200"
            >
              Masuk ke Sistem
            </button>
          </form>

        </div>
      </div>

    </main>
  )
}