import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '@/lib/supabase'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { captionMentah, polsek, photos } = body

    if (!captionMentah) {
      return NextResponse.json({ error: 'Caption mentah wajib diisi!' }, { status: 400 })
    }

    // 1. Ambil Data Pejabat dari Supabase secara Cerdas & Berdasarkan Caption
    let namaPejabat = ''
    const lowerCaption = captionMentah.toLowerCase()

    if (polsek) {
      if (polsek === 'Polres Subang') {
        const { data: pimpinan } = await supabase
          .from('database_pejabat')
          .select('nama_jabatan, nama_pejabat')
        
        if (pimpinan && pimpinan.length > 0) {
          // FILTER KETAT: Hanya ambil pejabat yang jabatannya/namanya benar-benar disebut di caption mentah!
          // Mencegah AI sok tahu mencatut jabatan seperti Wakapolres/PJU jika tidak ada di caption.
          const filteredPimpinan = pimpinan.filter(p => 
            lowerCaption.includes(p.nama_pejabat.toLowerCase()) || 
            lowerCaption.includes(p.nama_jabatan.toLowerCase())
          )

          if (filteredPimpinan.length > 0) {
            namaPejabat = filteredPimpinan.map(p => `${p.nama_jabatan}: ${p.nama_pejabat}`).join('; ')
          } else {
            // Jika caption umum (misal cuma sebut Kapolres tapi tidak sebut nama aslinya di teks), ambil data Kapolres saja
            const kapolresOnly = pimpinan.find(p => p.nama_jabatan.toLowerCase().includes('kapolres') && !p.nama_jabatan.toLowerCase().includes('wakapolres'))
            if (kapolresOnly) {
              namaPejabat = `${kapolresOnly.nama_jabatan}: ${kapolresOnly.nama_pejabat}`
            }
          }
        }
      } else {
        const { data: kapolsek } = await supabase
          .from('database_pejabat')
          .select('nama_pejabat')
          .eq('nama_jabatan', polsek)
          .single()
        
        if (kapolsek) {
          namaPejabat = kapolsek.nama_pejabat
        }
      }
    }

    // 2. System Instruction yang Diperketat
    const systemInstruction = `
Kamu adalah AI Assistant khusus Humas Polres Subang (SIM-HUMAS).
Tugasmu adalah menganalisis caption mentah DAN foto-foto dokumentasi kegiatan yang dilampirkan, lalu menyusun Narasi Berita Resmi 5W+1H sesuai SOP SPIT & Web Humas Polri.

ATURAN MUTLAK PEMILIHAN PEJABAT / PIMPINAN:
- Gunakan HANYA data pejabat berikut yang diizinkan untuk disebut:\n${namaPejabat || 'Hanya sebutkan pihak yang ada di caption.'}
- DILARANG KERAS mencantumkan nama pejabat lain (seperti Wakapolres atau PJU) jika data mereka tidak ada di daftar atas atau tidak disebut di caption mentah. Tulis HANYA pihak yang benar-benar memimpin/terlibat.

ATURAN MUTLAK ANTIPEMALSUAN & HALUSINASI VISUAL:
- DILARANG KERAS mengarang nama tempat spesifik (seperti nama toko, bank, jalan tertentu) jika tidak disebutkan secara eksplisit di dalam caption mentah operator. 
- Jika foto dokumentasi memperlihatkan ciri khas visual yang jelas (seperti Lapangan Tatag Trawang Tungga Mako Polres Subang), Anda diizinkan untuk menyertakannya secara akurat.

ATURAN STRICT PENULISAN:
1. JUDUL NARASI:
   - Capital Each Word. Ringkas, padat, mencerminkan inti kegiatan.
   - ATURAN JUDUL & NAMA: 
     * Jika kegiatan bersifat tunggal/rutin pimpinan utama (seperti Apel oleh Kapolres), DILARANG KERAS menyertakan nama spesifik orang di judul (Contoh: "Kapolres Subang Pimpin Apel...", bukan pakai nama panjang).
     * Jika kegiatan melibatkan kolaborasi lintas unit (seperti Kabag Ops bersanding dengan Kapolsek jajaran), cantumkan subjek utamanya secara jelas di judul (Contoh: "Kabag Ops Polres Subang Bersama Kapolsek ... Pimpin...").
   - JANGAN GUNAKAN simbol markdown seperti bintang ganda (**), garis pemisah (---), atau pagar (#) sama sekali.

2. ISI NARASI (5 Paragraf Standard):
   - Paragraf 1: Diawali nama lokasi/objek vital/tempat spesifik sesuai wilayah hukum ${polsek || 'Polres Subang'}.
   - Paragraf 2: Menjabarkan titik fokus, sasaran, dan tindakan fisik petugas berdasarkan foto dan caption.
   - Paragraf 3: Menyebutkan imbauan dialogis/kamtibmas humanis kepada warga/petugas jaga.
   - Paragraf 4: Wujud komitmen Polres Subang/Polsek Jajaran dalam memelihara Harkamtibmas & cegah C3.
   - Paragraf 5: Penutup bervariasi dan luwes tentang situasi kondusif.

FORMAT OUTPUT MURNI PLAIN TEXT (TANPA MARKDOWN APAPUN):
JUDUL NARASI :
[Tulis Judul Tanpa Bintang & Tanpa Nama Orang]

ISI NARASI :
[Tulis Isi 5 Paragraf Tanpa Bintang/Markdown]
`

    // 3. Konversi Foto Base64 ke Format Part untuk Gemini API
    const contentsArray: any[] = []
    
    contentsArray.push(
      `Olah caption mentah dan identifikasi detail tempat dari foto-foto kegiatan wilayah ${polsek || 'Polres Subang'} ini menjadi narasi berita resmi:\n\nCaption Mentah:\n${captionMentah}`
    )

    if (photos && Array.isArray(photos) && photos.length > 0) {
      for (const photoBase64 of photos) {
        const matches = photoBase64.match(/^data:(.+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          contentsArray.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          })
        }
      }
    }

    // 4. Eksekusi dengan Retry Loop gemini-3.6-flash
    let responseText = ''
    let maxRetries = 3
    let lastError = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response: any = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: contentsArray,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.1, // Diturunkan sedikit agar AI semakin deterministik dan patuh aturan
          },
        })
        
        responseText = response.text || ''
        if (responseText) break 
      } catch (err: any) {
        lastError = err.message || 'Terjadi kesalahan sistem'
        if (attempt === maxRetries) throw new Error(lastError)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    if (!responseText) {
      throw new Error(`Gagal menghasilkan teks. Alasan: ${lastError}`)
    }

    // Pembersihan tambahan di backend untuk membuang sisa markdown
    responseText = responseText
      .replace(/\*\*/g, '')
      .replace(/---/g, '')
      .replace(/###/g, '')
      .trim()

    // 5. Simpan Riwayat ke Supabase
    await supabase.from('history_narasi').insert([
      {
        polsek: polsek || 'Polres Subang',
        caption_mentah: captionMentah,
        hasil_narasi: responseText
      }
    ])

    return NextResponse.json({
      success: true,
      hasilNarasi: responseText
    })

  } catch (error: any) {
    console.error('API Error Fatal:', error)
    return NextResponse.json({ 
      error: error.message || 'Server Gemini sedang sibuk. Silakan coba klik Generate sekali lagi.' 
    }, { status: 500 })
  }
}