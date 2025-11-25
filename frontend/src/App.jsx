import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  PieChart, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Building2, 
  Quote,
  RefreshCw,
  Sparkles,
  BrainCircuit,
  Loader2
} from 'lucide-react';

// --- Global Dəyişənlər (Canvas Tərəfindən Təmin Olunur) ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Backend URL ---
// Vercel deployment üçün sadəcə /api istifadə edirik (vercel.json tərəfindən yönləndirilir)
const BACKEND_URL = '/api'; 

// --- Firebase İnitializasiyası ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Standart Motivasiya Sitatları ---
const MOTIVATION_QUOTES = [
  "Böyük işlər kiçik addımlarla başlayır.",
  "Uğur cəsarət tələb edir.",
  "Biznesdə ən vacib şey səbr və davamlılıqdır.",
  "Xərclərinizi idarə etmirsinizsə, gəlirlərinizin mənası yoxdur.",
  "Risk etməyən şampan içməz.",
  "Keyfiyyət heç vaxt təsadüf deyil, hər zaman ağıllı səyin nəticəsidir.",
  "Müştəri ən vacib ziyarətçimizdir.",
  "Uğursuzluq yenidən başlamaq üçün bir fürsətdir, bu dəfə daha ağıllıca.",
  "Vaxt puldan daha dəyərlidir. Siz daha çox pul qazana bilərsiniz, amma daha çox vaxt qazana bilməzsiniz.",
  "Liderlik bir mövqe deyil, bir fəaliyyətdir."
];

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense'); 
  const [quote, setQuote] = useState(MOTIVATION_QUOTES[0]);
  
  // AI States
  const [aiAdvice, setAiAdvice] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  // 1. Auth İnitializasiyası
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Məlumatların Gətirilməsi (Firestore)
  useEffect(() => {
    if (!user) return;

    // Şirkət əməliyyatlarını istifadəçiyə özəl saxlayırıq
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // JavaScript tərəfində sıralama (yeni tarixdən köhnəyə)
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });

      setTransactions(data);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Hesablamalar
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [transactions]);

  // --- Backend API Çağırış Funksiyaları ---

  // ✨ Feature 1: AI Maliyyə Təhlili (Backend-ə zəng)
  const handleAIAnalysis = async () => {
    if (isAnalyzing || !user) return;
    setIsAnalyzing(true);
    setAiAdvice('');

    // Son 10 əməliyyatı prompt-a daxil etmək üçün götürürük
    const recentTx = transactions.slice(0, 10).map(t => ({
      desc: t.description,
      amount: t.amount,
      type: t.type
    }));

    const prompt = `
      Sən peşəkar bir maliyyə məsləhətçisisən (financial advisor). 
      Aşağıdakı şirkət məlumatlarına əsasən, Azərbaycan dilində istifadəçiyə 2-3 cümləlik strateji, konkret və faydalı məsləhət ver.
      
      Ümumi Gəlir: ${stats.income} AZN
      Ümumi Xərc: ${stats.expense} AZN
      Balans: ${stats.balance} AZN
      
      Son əməliyyatlar: ${JSON.stringify(recentTx)}
      
      Məsləhət tonu: Peşəkar, motivasiyaedici və ehtiyatlı. Birbaşa istifadəçiyə xitab et.
    `;

    try {
      // BACKEND_URL + endpoint
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.advice || "Analiz nəticəsi alınmadı.";
      setAiAdvice(result);

    } catch (error) {
      console.error("Backend Analiz Xətası:", error);
      setAiAdvice("Xəta baş verdi. Zəhmət olmasa, AI serverless funksiyasının işlədiyindən və GEMINI_API_KEY-in təyin olunduğundan əmin olun.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ✨ Feature 2: Ağıllı Sitat (Smart Quote) (Backend-ə zəng)
  const handleSmartQuote = async () => {
    if (isQuoteLoading || !user) return;
    setIsQuoteLoading(true);

    const prompt = `
      Şirkətin balansı ${stats.balance} AZN-dir.
      Bu vəziyyətə uyğun (müsbətdirsə artırmaq, mənfidirsə ruhdan düşməmək barədə)
      Azərbaycan dilində 1 ədəd qısa, təsirli, "ağıllı" bir biznes aforizmi və ya motivasiya cümləsi yaz.
      Sadəcə cümləni qaytar. Dırnaq işarəsi qoyma.
    `;

    try {
      // BACKEND_URL + endpoint
      const response = await fetch(`${BACKEND_URL}/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.quote || "Yeni sitat gətirilə bilmədi.";
      setQuote(result);
      
    } catch (error) {
      console.error("Backend Sitat Xətası:", error);
      setQuote("AI sitat gətirmə zamanı xəta baş verdi. Serverless funksiyanı yoxlayın.");
    } finally {
      setIsQuoteLoading(false);
    }
  };

  const refreshStandardQuote = () => {
    const randomIndex = Math.floor(Math.random() * MOTIVATION_QUOTES.length);
    setQuote(MOTIVATION_QUOTES[randomIndex]);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!description || !amount || !user) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
        description,
        amount: parseFloat(amount),
        type,
        createdAt: serverTimestamp()
      });
      setDescription('');
      setAmount('');
    } catch (error) {
      console.error("Add Error:", error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      style: 'currency',
      currency: 'AZN'
    }).format(amount);
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="animate-spin mr-2" /> Yüklənir...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
              <Building2 size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Şirkət Büdcəsi <span className="text-xs bg-indigo-500/50 px-2 py-0.5 rounded border border-indigo-400/30">AI Powered ✨</span>
              </h1>
              <p className="text-blue-100 text-sm opacity-90">Ağıllı Maliyyə İdarəetmə Sistemi</p>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-sm opacity-75">İstifadəçi ID:</p>
            <p className="font-mono text-xs bg-black/20 px-2 py-1 rounded">{user?.uid?.slice(0, 8)}...</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Motivasiya Kartı */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Quote size={64} className="text-indigo-600" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <h2 className="text-indigo-600 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} /> Günün Motivasiyası
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={handleSmartQuote}
                  disabled={isQuoteLoading}
                  className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  title="AI ilə şirkət vəziyyətinə uyğun sitat gətir"
                >
                  {isQuoteLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} 
                  AI Sitat
                </button>
                <button 
                  onClick={refreshStandardQuote}
                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Təsadüfi sitat"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
            <p className="text-xl md:text-2xl font-medium text-slate-700 italic transition-all duration-300">
              "{quote}"
            </p>
          </div>
        </div>

        {/* Statistikalar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Ümumi Gəlir</p>
              <p className="text-2xl font-bold text-emerald-600">{formatMoney(stats.income)}</p>
            </div>
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Ümumi Xərc</p>
              <p className="text-2xl font-bold text-rose-600">{formatMoney(stats.expense)}</p>
            </div>
            <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
              <TrendingDown size={24} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-medium mb-1">Cari Balans</p>
              <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                {formatMoney(stats.balance)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <Wallet size={24} />
            </div>
          </div>
        </div>

        {/* ✨ AI Maliyyə Məsləhətçisi Bölməsi */}
        <div className="bg-gradient-to-br from-indigo-900 to-purple-800 rounded-xl shadow-lg text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BrainCircuit size={120} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                <Sparkles className="text-yellow-300" size={24} />
              </div>
              <h2 className="text-xl font-bold">AI Maliyyə Məsləhətçisi</h2>
            </div>

            {aiAdvice ? (
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-lg leading-relaxed text-indigo-50">
                  {aiAdvice}
                </p>
                <div className="mt-4 flex justify-end">
                   <button 
                    onClick={() => setAiAdvice('')}
                    className="text-xs text-indigo-200 hover:text-white underline"
                   >
                     Məsləhəti bağla
                   </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-indigo-100 max-w-2xl">
                  Gemini süni intellekti gəlir və xərclərinizi analiz edərək şirkətiniz üçün ən doğru strateji addımları təklif edə bilər.
                </p>
                <button
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing}
                  className="bg-white text-indigo-900 hover:bg-indigo-50 px-6 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Analiz edilir...
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={20} />
                      Maliyyə Analizi Et
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Əməliyyat Əlavə Et */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plus size={20} className="text-blue-600" /> Yeni Əməliyyat
              </h3>
              
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Təsvir</label>
                  <input
                    type="text"
                    required
                    placeholder="Məs: Ofis kirayəsi"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Məbləğ (AZN)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Növ</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        type === 'income' 
                          ? 'bg-emerald-600 text-white shadow-md' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingUp size={16} /> Gəlir
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                        type === 'expense' 
                          ? 'bg-rose-600 text-white shadow-md' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingDown size={16} /> Xərc
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
                >
                  <Plus size={20} /> Əlavə Et
                </button>
              </form>
            </div>
          </div>

          {/* Sağ: Tarixçə */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <PieChart size={20} className="text-blue-600" /> Əməliyyat Tarixçəsi
                </h3>
                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  {transactions.length} əməliyyat
                </span>
              </div>

              <div className="overflow-y-auto max-h-[600px]">
                {transactions.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <Wallet size={32} />
                    </div>
                    <p>Hələ heç bir məlumat yoxdur. Sol tərəfdən yeni əməliyyat əlavə edin.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.map((t) => (
                      <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {t.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{t.description}</p>
                            <p className="text-xs text-slate-500">
                              {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('az-AZ') : 'Tarix yoxdur'} • 
                              {t.type === 'income' ? ' Gəlir' : ' Xərc'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={`font-bold ${
                            t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                          </p>
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                            title="Sil"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
