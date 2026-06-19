import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, BookOpen, Heart, ChevronLeft, Star, Shuffle, Settings, X, Volume2, BarChart3, CheckCircle, XCircle, Info } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Fuse from 'fuse.js'
import { registerPlugin } from '@capacitor/core'
import wordData from './data/words.json'
import wordLevels from './data/word-levels.json'

// 注册自定义原生 TTS 插件
const NativeTTS = registerPlugin('NativeTTS')

// 单词级别标签配置
const LEVEL_CONFIG = {
  'cet4':   { label: '四级', color: 'bg-green-100 text-green-700' },
  'cet6':   { label: '六级', color: 'bg-blue-100 text-blue-700' },
  'cet4+6': { label: '四六级', color: 'bg-purple-100 text-purple-700' },
  'beyond': { label: '超纲', color: 'bg-gray-100 text-gray-500' },
}

function getWordLevel(word) {
  return wordLevels[word.toLowerCase()] || 'beyond'
}

function LevelTag({ word }) {
  const level = getWordLevel(word)
  const config = LEVEL_CONFIG[level]
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${config.color} font-medium`}>
      {config.label}
    </span>
  )
}

const SECTIONS = [
  { id: 'home', label: '单词本', icon: BookOpen },
  { id: 'favorites', label: '收藏', icon: Heart },
  { id: 'settings', label: '设置', icon: Settings },
]

function App() {
  const [currentView, setCurrentView] = useState('home')
  const [selectedWord, setSelectedWord] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gptwordbook_favorites') || '[]') } catch { return [] }
  })
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gptwordbook_history') || '[]') } catch { return [] }
  })
  const [searchResults, setSearchResults] = useState([])
  const [dailyWord, setDailyWord] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [fuse, setFuse] = useState(null)
  const [wordsList, setWordsList] = useState([])
  const [ttsReady, setTtsReady] = useState(false)

  // App 启动时初始化 TTS 引擎
  useEffect(() => {
    const initTTS = async () => {
      try {
        // 等待插件加载
        await new Promise(r => setTimeout(r, 1000))
        const result = await NativeTTS.isAvailable()
        setTtsReady(result.available)
        if (!result.available) {
          console.warn('TTS not available on this device')
        }
      } catch (e) {
        console.warn('TTS init error:', e)
      }
    }
    initTTS()
  }, [])

  useEffect(() => {
    const words = Object.entries(wordData).map(([word, data]) => ({ word, ...data }))
    setWordsList(words)
    setFuse(new Fuse(words, { keys: ['word'], threshold: 0.3, includeScore: true }))

    const today = new Date().toDateString()
    const savedDaily = localStorage.getItem('gptwordbook_daily')
    const savedDate = localStorage.getItem('gptwordbook_daily_date')
    if (savedDaily && savedDate === today) {
      setDailyWord(JSON.parse(savedDaily))
    } else {
      const randomWord = words[Math.floor(Math.random() * words.length)]
      setDailyWord(randomWord)
      localStorage.setItem('gptwordbook_daily', JSON.stringify(randomWord))
      localStorage.setItem('gptwordbook_daily_date', today)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('gptwordbook_favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem('gptwordbook_history', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    if (searchQuery.trim() && fuse) {
      const results = fuse.search(searchQuery.trim()).slice(0, 50)
      setSearchResults(results.map(r => r.item))
    } else {
      setSearchResults([])
    }
  }, [searchQuery, fuse])

  const toggleFavorite = useCallback((word) => {
    setFavorites(prev => prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word])
  }, [])

  const addToHistory = useCallback((word) => {
    setHistory(prev => [word, ...prev.filter(w => w !== word)].slice(0, 50))
  }, [])

  const openWord = useCallback((wordObj) => {
    setSelectedWord(wordObj)
    addToHistory(wordObj.word)
  }, [addToHistory])

  const isFavorite = (word) => favorites.includes(word)

  const getRandomWord = () => {
    if (wordsList.length === 0) return
    const random = wordsList[Math.floor(Math.random() * wordsList.length)]
    openWord(random)
  }

  if (selectedWord) {
    return (
      <WordDetail
        wordData={selectedWord}
        onBack={() => setSelectedWord(null)}
        isFavorite={isFavorite(selectedWord.word)}
        onToggleFavorite={() => toggleFavorite(selectedWord.word)}
        ttsReady={ttsReady}
      />
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-sky-500 text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">GPT 单词本</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-full hover:bg-sky-400 transition">
              <Search size={20} />
            </button>
            <button onClick={getRandomWord} className="p-2 rounded-full hover:bg-sky-400 transition">
              <Shuffle size={20} />
            </button>
          </div>
        </div>
      </header>

      {showSearch && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="bg-sky-500 text-white px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <Search size={20} className="text-sky-200" />
            <input
              autoFocus
              type="text"
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder-sky-200 outline-none text-base"
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="p-1">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchQuery.trim() ? (
              <div className="divide-y divide-gray-100">
                {searchResults.map(item => (
                  <button
                    key={item.word}
                    onClick={() => { openWord(item); setShowSearch(false); setSearchQuery('') }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-gray-900">{item.word}</span>
                    {isFavorite(item.word) && <Star size={16} className="text-yellow-400 fill-yellow-400" />}
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="p-8 text-center text-gray-400">未找到相关单词</div>
                )}
              </div>
            ) : (
              <div className="p-4">
                {history.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">最近浏览</h3>
                    <div className="flex flex-wrap gap-2">
                      {history.slice(0, 10).map(w => (
                        <button
                          key={w}
                          onClick={() => {
                            const wordObj = wordsList.find(item => item.word === w)
                            if (wordObj) { openWord(wordObj); setShowSearch(false) }
                          }}
                          className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700 hover:bg-gray-200"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {currentView === 'home' && (
          <HomeView dailyWord={dailyWord} onOpenWord={openWord} wordsList={wordsList} isFavorite={isFavorite} />
        )}
        {currentView === 'favorites' && (
          <FavoritesView favorites={favorites} wordsList={wordsList} onOpenWord={openWord} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
        )}
        {currentView === 'settings' && (
          <SettingsView totalWords={wordsList.length} favoritesCount={favorites.length} onClearHistory={() => setHistory([])} onClearFavorites={() => setFavorites([])} />
        )}
      </main>

      <nav className="bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around">
          {SECTIONS.map(section => {
            const Icon = section.icon
            const isActive = currentView === section.id
            return (
              <button
                key={section.id}
                onClick={() => setCurrentView(section.id)}
                className={`flex flex-col items-center py-2 px-4 flex-1 transition ${isActive ? 'text-sky-500' : 'text-gray-400'}`}
              >
                <Icon size={22} />
                <span className="text-xs mt-0.5">{section.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function HomeView({ dailyWord, onOpenWord, wordsList, isFavorite }) {
  const [letterFilter, setLetterFilter] = useState('')
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  const filteredWords = letterFilter
    ? wordsList.filter(w => w.word.toUpperCase().startsWith(letterFilter))
    : wordsList.slice(0, 100)

  return (
    <div className="pb-4">
      {dailyWord && (
        <div className="mx-4 mt-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">每日一词</div>
          <button
            onClick={() => onOpenWord(dailyWord)}
            className="w-full rounded-2xl p-5 text-white text-left shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{dailyWord.word}</div>
                <div className="text-sky-100 text-sm mt-1 line-clamp-2">
                  {dailyWord.content?.substring(0, 80).replace(/[#*\n]/g, '')}...
                </div>
              </div>
              {isFavorite(dailyWord.word) && <Star size={24} className="text-yellow-300 fill-yellow-300" />}
            </div>
          </button>
        </div>
      )}

      <div className="mt-4 px-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">按字母浏览</div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
          <button
            onClick={() => setLetterFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${letterFilter === '' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            全部
          </button>
          {letters.map(l => (
            <button
              key={l}
              onClick={() => setLetterFilter(l === letterFilter ? '' : l)}
              className={`w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition ${letterFilter === l ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {letterFilter ? `以 "${letterFilter}" 开头的单词` : '热门单词'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredWords.slice(0, 60).map(item => (
            <button
              key={item.word}
              onClick={() => onOpenWord(item)}
              className="bg-white rounded-xl p-3 text-left shadow-sm border border-gray-100 hover:shadow-md transition active:scale-95"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{item.word}</span>
                <div className="flex items-center gap-1">
                  <LevelTag word={item.word} />
                  {isFavorite(item.word) && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                {item.content?.substring(0, 40).replace(/[#*\n]/g, '')}...
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function FavoritesView({ favorites, wordsList, onOpenWord, isFavorite, onToggleFavorite }) {
  const favWords = favorites.map(w => wordsList.find(item => item.word === w)).filter(Boolean)

  if (favWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Heart size={48} className="mb-4 text-gray-300" />
        <p>暂无收藏单词</p>
        <p className="text-sm mt-1">点击单词详情页的星标来收藏</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">已收藏 {favorites.length} 个单词</div>
      <div className="space-y-2">
        {favWords.map(item => (
          <div key={item.word} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
            <button onClick={() => onOpenWord(item)} className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{item.word}</span>
                <LevelTag word={item.word} />
              </div>
              <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                {item.content?.substring(0, 60).replace(/[#*\n]/g, '')}...
              </div>
            </button>
            <button onClick={() => onToggleFavorite(item.word)} className="p-2 ml-2">
              <Star size={20} className="text-yellow-400 fill-yellow-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CoverageReport({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">词汇覆盖率报告</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 总词数 */}
          <div className="bg-sky-50 rounded-xl p-4 text-center">
            <div className="text-sm text-sky-600">词库总量</div>
            <div className="text-3xl font-bold text-sky-500">7,954</div>
            <div className="text-xs text-sky-400 mt-1">远超四六级要求</div>
          </div>

          {/* 四六级覆盖率 */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 size={18} className="text-sky-500" />
              四六级覆盖率
            </h3>

            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">CET-4</span>
                <span className="text-sm font-bold text-green-500">99.96%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{width: '99.96%'}}></div>
              </div>
              <div className="text-xs text-gray-400 mt-1">4,541 / 4,543 词</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">CET-6</span>
                <span className="text-sm font-bold text-green-500">99.95%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{width: '99.95%'}}></div>
              </div>
              <div className="text-xs text-gray-400 mt-1">3,989 / 3,991 词</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">CET-4 + CET-6 合并</span>
                <span className="text-sm font-bold text-green-500">99.94%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{width: '99.94%'}}></div>
              </div>
              <div className="text-xs text-gray-400 mt-1">6,657 / 6,661 词</div>
            </div>
          </div>

          {/* 未覆盖词汇 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <XCircle size={18} className="text-orange-500" />
              未覆盖词汇（仅 4 个）
            </h3>
            <div className="bg-orange-50 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">CET-4</span>
                <div className="text-sm">
                  <span className="font-mono font-medium">administrative</span>
                  <span className="text-gray-500"> — 行政的</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">CET-4</span>
                <div className="text-sm">
                  <span className="font-mono font-medium">negro</span>
                  <span className="text-gray-500"> — 黑人（现代英语已少用）</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded">CET-6</span>
                <div className="text-sm">
                  <span className="font-mono font-medium">abbreviation</span>
                  <span className="text-gray-500"> — 缩写</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded">CET-6</span>
                <div className="text-sm">
                  <span className="font-mono font-medium">countermeasure</span>
                  <span className="text-gray-500"> — 对策、反制措施</span>
                </div>
              </div>
            </div>
          </div>

          {/* 超出四六级的词汇 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle size={18} className="text-sky-500" />
              超出四六级范围
            </h3>
            <div className="bg-sky-50 rounded-xl p-3">
              <div className="text-sm text-sky-700">
                本词库包含 <span className="font-bold">1,297</span> 个超出 CET-4/6 范围的词汇，涵盖高级学术词汇、专有名词、GRE/托福词汇等，适合进阶学习。
              </div>
            </div>
          </div>

          {/* 数据来源 */}
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div>
              数据来源：github.com/Ceelog/DictionaryByGPT4（GPT-4 生成解析）<br/>
              四六级词表：github.com/KyleBing/english-vocabulary
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsView({ totalWords, favoritesCount, onClearHistory, onClearFavorites }) {
  const [showCoverage, setShowCoverage] = useState(false)

  return (
    <div className="p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowCoverage(true)}
          className="w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">词库总量</div>
              <div className="text-2xl font-bold text-sky-500">{totalWords.toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-1 text-sky-500 text-sm">
              <BarChart3 size={16} />
              <span>查看覆盖率</span>
            </div>
          </div>
        </button>
        <div className="p-4">
          <div className="text-sm text-gray-500">已收藏</div>
          <div className="text-2xl font-bold text-sky-500">{favoritesCount}</div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => { if (confirm('确定要清空浏览历史吗？')) onClearHistory() }}
          className="w-full p-4 text-left text-red-500 border-b border-gray-100 hover:bg-gray-50 transition"
        >
          清空浏览历史
        </button>
        <button
          onClick={() => { if (confirm('确定要清空所有收藏吗？')) onClearFavorites() }}
          className="w-full p-4 text-left text-red-500 hover:bg-gray-50 transition"
        >
          清空收藏
        </button>
      </div>

      <div className="mt-6 text-center text-xs text-gray-400">
        <p>GPT 单词本 v2.0.0</p>
        <p className="mt-1">新增音标显示 + TTS 发音</p>
        <p className="mt-1">数据来源: github.com/Ceelog/DictionaryByGPT4</p>
      </div>

      {showCoverage && <CoverageReport onClose={() => setShowCoverage(false)} />}
    </div>
  )
}

// 发音音频缓存（同一个单词只请求一次有道 API）
const audioCache = {}

function WordDetail({ wordData, onBack, isFavorite, onToggleFavorite, ttsReady }) {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef(null)

  const speak = () => {
    if (speaking) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(true)

    // 优先使用缓存
    if (audioCache[wordData.word]) {
      const audio = new Audio(audioCache[wordData.word])
      audioRef.current = audio
      audio.onended = () => setSpeaking(false)
      audio.onerror = () => setSpeaking(false)
      audio.play()
      return
    }

    // 从有道词典获取真人发音并缓存
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(wordData.word)}&type=2`
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setSpeaking(false)
    audio.onerror = async () => {
      // 有道失败时，尝试原生 TTS
      try {
        await NativeTTS.speak({
          text: wordData.word,
          lang: 'en-US',
          rate: 0.9,
          pitch: 1.0,
          volume: 1.0
        })
        setTimeout(() => setSpeaking(false), 2000)
      } catch (e) {
        console.error('All speak methods failed:', e)
        setSpeaking(false)
      }
    }
    // 缓存音频 URL（浏览器会自动缓存音频数据）
    audioCache[wordData.word] = url
    audio.play()
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-sky-500 text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-sky-400 transition">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold truncate max-w-[200px]">{wordData.word}</h1>
          <button onClick={onToggleFavorite} className="p-2 -mr-2 rounded-full hover:bg-sky-400 transition">
            <Star size={22} className={isFavorite ? 'text-yellow-300 fill-yellow-300' : 'text-white'} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl font-bold text-gray-900">{wordData.word}</div>
            <LevelTag word={wordData.word} />
            <button
              onClick={speak}
              className={`p-2 rounded-full transition ${speaking ? 'bg-sky-500 text-white animate-pulse' : 'bg-sky-50 text-sky-500 hover:bg-sky-100'}`}
              title="播放发音"
            >
              <Volume2 size={20} />
            </button>
          </div>
          {wordData.ipa && (
            <div className="text-lg text-sky-500 font-mono mb-4">
              /{wordData.ipa}/
            </div>
          )}
          <div className="markdown-content text-sm">
            <ReactMarkdown>{wordData.content || ''}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
