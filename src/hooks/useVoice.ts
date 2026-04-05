import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition
    SpeechRecognition: new () => SpeechRecognition
  }
}

interface UseVoiceReturn {
  /** Start listening for speech */
  startListening: () => void
  /** Stop listening and finalize transcript */
  stopListening: () => void
  /** Speak text aloud via TTS */
  speak: (text: string) => void
  /** Stop TTS playback */
  stopSpeaking: () => void
  /** Current transcript (interim + final) */
  transcript: string
  /** Whether STT is actively listening */
  isListening: boolean
  /** Whether TTS is speaking */
  isSpeaking: boolean
  /** Duration in seconds since recording started */
  duration: number
  /** Whether Web Speech API is supported */
  isSupported: boolean
  /** Error message if something went wrong */
  error: string | null
}

/**
 * Hook for browser-native speech-to-text and text-to-speech.
 * Uses Web Speech API — no API key, no server cost.
 *
 * STT: webkitSpeechRecognition / SpeechRecognition
 * TTS: SpeechSynthesisUtterance
 */
export function useVoice(): UseVoiceReturn {
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const isSupported =
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
      window.speechSynthesis?.cancel()
    }
  }, [])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    setDuration(0)
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser')
      return
    }

    setError(null)
    setTranscript('')

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      startTimer()
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? ''
        } else {
          interimTranscript += result[0]?.transcript ?? ''
        }
      }

      setTranscript(finalTranscript + interimTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'aborted' is expected when we call stop/abort
      if (event.error !== 'aborted') {
        setError(
          event.error === 'not-allowed'
            ? 'Microphone access denied. Please allow microphone permissions.'
            : `Speech recognition error: ${event.error}`
        )
      }
      setIsListening(false)
      stopTimer()
    }

    recognition.onend = () => {
      setIsListening(false)
      stopTimer()
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, startTimer, stopTimer])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    stopTimer()
  }, [stopTimer])

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  return {
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    transcript,
    isListening,
    isSpeaking,
    duration,
    isSupported,
    error,
  }
}