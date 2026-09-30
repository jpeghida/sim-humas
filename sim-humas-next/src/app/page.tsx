'use client'

import { useState, useEffect, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface FileWithPreview {
  file?: File
  preview: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [kapolsekList, setKapolsekList] = useState<string[]>([])
  const [selectedPolsek, setSelectedPolsek] = useState('Polres Subang')
  const [captionInput, setCaptionInput] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('Memproses Narasi Berita...')
  const [hasilNarasi, setHasilNarasi] = useState('')
  const [copied, setCopied] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState<string>('')
  const [errorWarning, setErrorWarning] = useState('')

  // State untuk Modal Direktori Pejabat & SOP
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pejabatData, setPejabatData] = useState<any[]>([])
  const [loadingPejabat, setLoadingPejabat] = useState(false)
  const [isSopModalOpen, setIsSopModalOpen] = useState(false)

  // Proteksi Sesi Login & Live Clock
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('sim_humas_logged_in')
    if (isLoggedIn !== 'true') {
      router.push('/login')
      return
    }

    const updateDateTime = () => {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }
      setCurrentDateTime(now.toLocaleDateString('id-ID', options))
    }
    updateDateTime()
    const timer = setInterval(updateDateTime, 60000)
    return () => clearInterval(timer)
  }, [router])

  // Auto-Load dari localStorage (Hanya Text) dan Fetch Supabase Pejabat
  useEffect(() => {
    const savedCaption = localStorage.getItem('sim_humas_caption')
    const savedPolsek = localStorage.getItem('sim_humas_polsek')
    const savedHasil = localStorage.getItem('sim_humas_hasil')

    if (savedCaption) setCaptionInput(savedCaption)
    if (savedPolsek) setSelectedPolsek(savedPolsek)
    if (savedHasil) setHasilNarasi(savedHasil)

    async function fetchPejabatDropdown() {
      try {
        const { data, error } = await supabase
          .from('database_pejabat')
          .select('nama_jabatan')
          .eq('kategori', 'Kapolsek')
          .order('nama_jabatan', { ascending: true })

        if (error) {
          console.error('Supabase Error:', error)
          return
        }

        if (data && data.length > 0) {
          const list = ['Polres Subang', ...data.map((item) => item.nama_jabatan)]
          setKapolsekList(list)
        } else {
          setKapolsekList(['Polres Subang'])
        }
      } catch (err) {
        console.error('Fetch error:', err)
        setKapolsekList(['Polres Subang'])
      }
    }
    fetchPejabatDropdown()
  }, [])

  // Fungsi Validasi Mismatch Wilayah Pintar
  const validateMismatch = (selectedWilayah: string, textCaption: string) => {
    const lowerCaption = textCaption.toLowerCase()
    let warning = ''

    if (selectedWilayah === 'Polres Subang' && lowerCaption.includes('polsek')) {
      warning = '⚠️ Peringatan Mismatch: Anda memilih "Polres Subang", namun caption mendeteksi kata "Polsek".'
    } else if (selectedWilayah.includes('Polsek') && lowerCaption.includes('kapolres') && !lowerCaption.includes('polsek')) {
      warning = `⚠️ Peringatan Mismatch: Anda memilih wilayah "${selectedWilayah}", namun caption menyebut tingkat "Kapolres".`
    }
    setErrorWarning(warning)
  }

  // Fungsi Membuka Modal Direktori Pejabat
  const handleOpenDirektori = async () => {
    setIsModalOpen(true)
    setLoadingPejabat(true)
    try {
      const { data, error } = await supabase
        .from('database_pejabat')
        .select('*')

      if (error) {
        console.error('Error fetching pejabat:', error)
      } else if (data) {
        const sortedData = data.sort((a, b) => {
          const jabA = a.nama_jabatan.toLowerCase()
          const jabB = b.nama_jabatan.toLowerCase()
          
          const isKapolresA = jabA.includes('kapolres') && !jabA.includes('wakapolres')
          const isKapolresB = jabB.includes('kapolres') && !jabB.includes('wakapolres')
          
          if (isKapolresA && !isKapolresB) return -1
          if (!isKapolresA && isKapolresB) return 1
          
          const isWakapolresA = jabA.includes('wakapolres')
          const isWakapolresB = jabB.includes('wakapolres')
          
          if (isWakapolresA && !isWakapolresB) return -1
          if (!isWakapolresA && isWakapolresB) return 1
          
          return jabA.localeCompare(jabB)
        })
        setPejabatData(sortedData)
      }
    } catch (err) {
      console.error('Exception fetching pejabat:', err)
    } finally {
      setLoadingPejabat(false)
    }
  }

  const handleCaptionChange = (val: string) => {
    setCaptionInput(val)
    localStorage.setItem('sim_humas_caption', val)
    validateMismatch(selectedPolsek, val)
  }

  const handlePolsekChange = (val: string) => {
    setSelectedPolsek(val)
    localStorage.setItem('sim_humas_polsek', val)
    validateMismatch(val, captionInput)
  }

  const handleClearCaption = () => {
    setCaptionInput('')
    setErrorWarning('')
    localStorage.removeItem('sim_humas_caption')
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  const processFiles = async (files: File[]) => {
    const newPreviews: FileWithPreview[] = []
    for (const file of files) {
      const base64 = await fileToBase64(file)
      newPreviews.push({ file, preview: base64 })
    }

    // Murni disimpan di state React (useState) saja tanpa menyentuh localStorage
    setUploadedFiles((prev) => [...prev, ...newPreviews])
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files)
      processFiles(filesArray)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      processFiles(filesArray)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Variabel Validasi Kelengkapan Form (Caption terisi & Min. 3 Foto)
  const isFormValid = captionInput.trim().length > 0 && uploadedFiles.length >= 3

  const handleGenerate = async () => {
    if (!isFormValid) {
      alert('Formulir belum lengkap! Pastikan Caption Mentah sudah diisi dan minimal mengunggah 3 Foto kegiatan.')
      return
    }

    setLoading(true)
    setHasilNarasi('')
    setLoadingText('Menghubungkan ke Server AI...')

    const timer1 = setTimeout(() => setLoadingText('Menganalisis Visual Foto & SOP SPIT...'), 4000)
    const timer2 = setTimeout(() => setLoadingText('Menyusun Paragraf 5W+1H...'), 10000)
    const timer3 = setTimeout(() => setLoadingText('Server Padat, Mencoba Menembus Antrean...'), 20000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captionMentah: captionInput,
          polsek: selectedPolsek,
          photos: uploadedFiles.map(f => f.preview)
        })
      })

      const data = await res.json()
      if (data.success) {
        setHasilNarasi(data.hasilNarasi)
        localStorage.setItem('sim_humas_hasil', data.hasilNarasi)
        
        setLoadingText('✓ Narasi Berhasil Disusun!')
        setTimeout(() => {
          setLoading(false)
        }, 3000)
      } else {
        alert('Gagal: ' + (data.error || 'Terjadi kesalahan sistem'))
        setLoading(false)
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi server.')
      setLoading(false)
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(hasilNarasi)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan seluruh form?')) {
      setCaptionInput('')
      setHasilNarasi('')
      setUploadedFiles([])
      setErrorWarning('')
      localStorage.removeItem('sim_humas_caption')
      localStorage.removeItem('sim_humas_hasil')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 font-sans">
      {/* Header Banner Instansi Clean & Professional + Tombol Logout */}
      <header className="mb-6 border border-slate-800 bg-slate-900/90 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3.5">
          <img 
            src="/logo.png" 
            alt="Logo Polri Presisi" 
            className="h-12 md:h-14 w-auto object-contain flex-shrink-0 drop-shadow-md"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none'
            }}
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-blue-600 text-white font-black px-2 py-0.5 rounded text-[11px] tracking-wider uppercase shadow-sm">SPIT PRESISI</span>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
                SIM-HUMAS POLRES SUBANG
              </h1>
            </div>
            <p className="text-slate-400 text-xs md:text-sm mt-1 font-normal">
              Sistem Pengolahan & Penyusunan Informasi Rilis Berita Polres Subang.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end sm:self-center">
          {currentDateTime && (
            <div className="bg-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-medium">
              {currentDateTime}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.removeItem('sim_humas_logged_in')
              router.push('/login')
            }}
            className="text-xs bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-300 px-3.5 py-1.5 rounded-lg border border-slate-700 transition font-semibold"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* PANEL KIRI: INPUT FORM */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xl backdrop-blur">
          <div>
            <div className="border-b border-slate-800 pb-3 mb-5 flex justify-between items-center">
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-100">
                Formulir Input Laporan
              </h2>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-semibold shadow-sm"
              >
                Reset Form
              </button>
            </div>

            <div className="space-y-5">
              
              {/* PILIH WILAYAH & TOMBOL DIREKTORI */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Pilih Wilayah / Polsek Jajaran
                </label>
                <select
                  value={selectedPolsek}
                  onChange={(e) => handlePolsekChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-sm md:text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer font-medium mb-2"
                >
                  {kapolsekList.map((polsek) => (
                    <option key={polsek} value={polsek} className="bg-slate-900 text-slate-100">
                      {polsek}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Butuh validasi nama pimpinan?</span>
                  <button
                    type="button"
                    onClick={handleOpenDirektori}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-semibold"
                  >
                    Cek Direktori Pejabat
                  </button>
                </div>
              </div>

              {/* Warning Mismatch Alert Pintar */}
              {errorWarning && (
                <div className="p-3 bg-amber-950/50 border border-amber-600/50 rounded-xl text-amber-300 text-xs font-medium animate-pulse">
                  {errorWarning}
                </div>
              )}

              {/* Caption Mentah */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-slate-200">
                    Caption Mentah Laporan
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {captionInput.length} karakter
                    </span>
                    {captionInput && (
                      <button
                        type="button"
                        onClick={handleClearCaption}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-700 transition font-semibold"
                      >
                        Bersihkan
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={captionInput}
                  onChange={(e) => handleCaptionChange(e.target.value)}
                  placeholder="Tempelkan teks laporan mentah dari WhatsApp atau Facebook di sini..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-600 font-sans"
                />
              </div>

              {/* Custom Drag & Drop Zone Foto */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-200">
                    Dokumentasi Foto Kegiatan
                  </label>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md transition ${
                    uploadedFiles.length === 0
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : uploadedFiles.length < 3 
                        ? 'bg-amber-950/90 text-amber-400 border border-amber-800' 
                        : 'bg-emerald-950/90 text-emerald-400 border border-emerald-800 shadow-sm'
                  }`}>
                    {uploadedFiles.length} Foto {uploadedFiles.length < 3 ? '(Min. 3 Foto)' : '(Terpenuhi)'}
                  </span>
                </div>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all duration-200 ${
                    isDragging
                      ? 'border-blue-400 bg-blue-500/15 shadow-md scale-[1.01]'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*, .jfif, .jpg, .jpeg, .png, .webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <p className="text-sm font-medium text-slate-200">
                      Tarik & lepas foto di sini, atau <span className="text-blue-400 underline font-semibold">Cari File</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Format: JPG, PNG, WEBP (Bebas upload banyak foto)</p>
                  </label>
                </div>

                {/* VISUAL IMAGE PREVIEW GRID */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2.5 max-h-44 overflow-y-auto pr-1">
                    {uploadedFiles.map((item, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-square shadow-sm">
                        <img
                          src={item.preview}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover transition group-hover:opacity-80"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute top-1 right-1 bg-slate-950/90 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold transition shadow"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`w-full font-bold text-sm md:text-base tracking-wider uppercase py-3.5 rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-3 ${
                loading 
                  ? 'bg-blue-800 text-white opacity-90 cursor-wait' 
                  : isFormValid 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.99] cursor-pointer shadow-blue-900/20' 
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{loadingText}</span>
                </>
              ) : isFormValid ? (
                <span>Generate Narasi Berita</span>
              ) : (
                <span>Lengkapi Form & Min. 3 Foto</span>
              )}
            </button>
          </div>
        </div>

        {/* PANEL KANAN: OUTPUT RESULT + DISCLAIMER + TOMBOL SOP */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xl backdrop-blur">
          <div className="h-full flex flex-col">
            <div className="border-b border-slate-800 pb-3 mb-5 flex justify-between items-center">
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-100">
                Hasil Narasi Resmi 5W+1H
              </h2>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSopModalOpen(true)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-700 transition font-semibold shadow-sm"
                >
                  SOP Polri
                </button>

                {hasilNarasi && (
                  <button
                    onClick={handleCopyText}
                    className={`font-bold text-xs md:text-sm px-3.5 py-1.5 rounded-xl transition shadow-md active:scale-95 flex items-center gap-1.5 ${
                      copied 
                        ? 'bg-amber-400 text-slate-950 border border-amber-300' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {copied ? '✓ Disalin!' : 'Salin Teks Narasi'}
                  </button>
                )}
              </div>
            </div>

            {hasilNarasi ? (
              <div className="flex-1 flex flex-col">
                <textarea
                  readOnly
                  value={hasilNarasi}
                  className="w-full flex-1 min-h-[350px] bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none font-sans shadow-inner"
                />
                <p className="text-xs text-slate-400 font-medium mt-3 italic text-center">
                  * Catatan: Teks di atas merupakan draf susunan AI dan wajib ditinjau ulang (<span className="text-slate-200 underline">human-in-the-loop</span>) oleh operator sebelum dipublikasikan.
                </p>
              </div>
            ) : (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 p-6 text-center bg-slate-950/40">
                <p className="text-base font-bold text-slate-300">Pratinjau Narasi Berita Resmi</p>
                <p className="text-xs md:text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
                  Tempelkan caption mentah di panel kiri lalu klik tombol <strong className="text-slate-400">"Generate Narasi Berita"</strong> untuk menyusun berita 5W+1H otomatis.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL / POPUP 1: DIREKTORI PEJABAT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div>
                <h3 className="text-base md:text-lg font-bold text-white uppercase tracking-wider">
                  Direktori Pejabat Utama & Jajaran
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sinkronisasi Database Supabase • Latest Update 11 September setelah Sertijab.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-950 hover:text-red-400 w-8 h-8 rounded-xl flex items-center justify-center transition text-sm font-bold border border-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingPejabat ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs">Memuat data direktori pejabat dari database...</p>
                </div>
              ) : pejabatData.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3 font-semibold">Jabatan / Wilayah</th>
                        <th className="p-3 font-semibold">Nama Pejabat Aktif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {pejabatData.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-800/50 transition">
                          <td className="p-3 font-medium text-white text-xs md:text-sm">{item.nama_jabatan || '-'}</td>
                          <td className="p-3 text-slate-200 text-xs md:text-sm">{item.nama_pejabat || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-sm">
                  <p>Belum ada data pejabat yang tersimpan di tabel Supabase.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <span className="text-[11px] text-slate-500 italic">Data resmi terhubung dengan database Supabase.</span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                Tutup Direktori
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL / POPUP 2: STANDAR SOP POLRI */}
      {isSopModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div>
                <h3 className="text-base md:text-lg font-bold text-white uppercase tracking-wider">
                  Standar SOP & Sistematika Penulisan
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Panduan Teknis Penyusunan Rilis Berita SPIT Polres Subang
                </p>
              </div>
              <button
                onClick={() => setIsSopModalOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-950 hover:text-red-400 w-8 h-8 rounded-xl flex items-center justify-center transition text-sm font-bold border border-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3 text-xs md:text-sm text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <strong className="text-blue-400 block mb-1">1. Tanpa Format Markdown / WhatsApp</strong>
                Output wajib bersih dari simbol bold (<code className="text-amber-300">**</code>), italic (<code className="text-amber-300">*</code>), atau pagar (<code className="text-amber-300">###</code>).
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <strong className="text-blue-400 block mb-1">2. Struktur Judul Resmi</strong>
                Singkat, padat, kapital di awal kata (Capital Each Word), dan dilarang memuat nama personil kecuali kegiatan pimpinan utama.
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <strong className="text-blue-400 block mb-1">3. Awalan Paragraf Pertama</strong>
                Wajib diawali dengan informasi lokasi, objek vital, atau wilayah yurisdiksi tempat kegiatan berlangsung.
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <strong className="text-blue-400 block mb-1">4. Prinsip Human-in-the-Loop</strong>
                AI bertindak sebagai asisten penyusun draf, validasi akhir mutlak berada di tangan operator manusia sebelum dipublikasikan.
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button 
                onClick={() => setIsSopModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                Tutup Panduan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}