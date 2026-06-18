import React, { useState, useEffect, useCallback } from 'react'
import { Search, BookOpen, Heart, ChevronLeft, Star, Shuffle, Settings, X, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Fuse from 'fuse.js'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'
import wordData from './data/words.json'

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
                {isFavorite(item.word) && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
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
              <div className="font-semibold text-gray-900">{item.word}</div>
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

function SettingsView({ totalWords, favoritesCount, onClearHistory, onClearFavorites }) {
  return (
    <div className="p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="text-sm text-gray-500">词库总量</div>
          <div className="text-2xl font-bold text-sky-500">{totalWords.toLocaleString()}</div>
        </div>
        <div className="p-4 border-b border-gray-100">
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
    </div>
  )
}

function WordDetail({ wordData, onBack, isFavorite, onToggleFavorite }) {
  const [speaking, setSpeaking] = useState(false)

  const speak = async () => {
    try {
      setSpeaking(true)

      // 方案1: 使用 Capacitor 原生 TTS
      if (Capacitor.isNativePlatform()) {
        try {
          await TextToSpeech.stop()
          await TextToSpeech.speak({
            text: wordData.word,
            lang: 'en-US',
            rate: 0.9,
            pitch: 1.0,
            volume: 1.0
          })
          setSpeaking(false)
          return
        } catch (e) {
          console.warn('Native TTS failed, trying fallback:', e)
        }
      }

      // 方案2: 使用 Web Speech API (fallback)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(wordData.word)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        utterance.onend = () => setSpeaking(false)
        utterance.onerror = () => setSpeaking(false)
        window.speechSynthesis.speak(utterance)
        return
      }

      // 方案3: 使用 Audio + Google TTS (最终 fallback)
      const audio = new Audio()
      audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(wordData.word)}&tl=en&client=tw-ob`
      audio.onended = () => setSpeaking(false)
      audio.onerror = () => setSpeaking(false)
      audio.play()
    } catch (e) {
      console.error('All TTS methods failed:', e)
      setSpeaking(false)
    }
  }

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
