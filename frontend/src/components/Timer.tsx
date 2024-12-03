import { useState, useEffect } from 'react'

export default function Timer() {
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false)
  const [isCountdownRunning, setIsCountdownRunning] = useState(false)
  const [stopwatchTime, setStopwatchTime] = useState(0)
  const [countdownTime, setCountdownTime] = useState(0)
  const [inputMinutes, setInputMinutes] = useState('')

  useEffect(() => {
    let stopwatchInterval: NodeJS.Timeout | null = null
    let countdownInterval: NodeJS.Timeout | null = null

    if (isStopwatchRunning) {
      stopwatchInterval = setInterval(() => {
        setStopwatchTime(prev => prev + 1)
      }, 1000)
    }

    if (isCountdownRunning) {
      countdownInterval = setInterval(() => {
        setCountdownTime(prev => {
          if (prev <= 0) {
            setIsCountdownRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (stopwatchInterval) clearInterval(stopwatchInterval)
      if (countdownInterval) clearInterval(countdownInterval)
    }
  }, [isStopwatchRunning, isCountdownRunning])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center space-x-6">
      {/* ストップウォッチ */}
      <div className="flex items-center space-x-2">
        <span title="ストップウォッチ">⏱️</span>
        <span className="font-mono text-lg">
          {formatTime(stopwatchTime)}
        </span>
        <div className="flex space-x-1">
          {!isStopwatchRunning ? (
            <button
              onClick={() => setIsStopwatchRunning(true)}
              className="text-green-600 hover:text-green-700"
              title="開始"
            >
              ▶️
            </button>
          ) : (
            <button
              onClick={() => setIsStopwatchRunning(false)}
              className="text-red-600 hover:text-red-700"
              title="停止"
            >
              ⏸️
            </button>
          )}
          <button
            onClick={() => {
              setIsStopwatchRunning(false)
              setStopwatchTime(0)
            }}
            className="text-gray-600 hover:text-gray-700"
            title="リセット"
          >
            🔄
          </button>
        </div>
      </div>

      {/* カウントダウン */}
      <div className="flex items-center">
        <span title="カウントダウン" className="mr-1">⏲️</span>
        <input
          type="number"
          value={inputMinutes}
          onChange={(e) => setInputMinutes(e.target.value)}
          placeholder="分"
          className="w-16 text-sm border-0 bg-transparent focus:ring-0 text-center px-2"
          disabled={isCountdownRunning}
        />
        <span className="font-mono text-lg ml-2">
          {formatTime(countdownTime)}
        </span>
        <div className="flex space-x-1 ml-2">
          {!isCountdownRunning ? (
            <button
              onClick={() => {
                const minutes = parseInt(inputMinutes)
                if (!isNaN(minutes)) {
                  setCountdownTime(minutes * 60)
                  setIsCountdownRunning(true)
                }
              }}
              className="text-green-600 hover:text-green-700"
              title="開始"
            >
              ▶️
            </button>
          ) : (
            <button
              onClick={() => setIsCountdownRunning(false)}
              className="text-red-600 hover:text-red-700"
              title="停止"
            >
              ⏸️
            </button>
          )}
          <button
            onClick={() => {
              setIsCountdownRunning(false)
              setCountdownTime(0)
              setInputMinutes('')
            }}
            className="text-gray-600 hover:text-gray-700"
            title="リセット"
          >
            🔄
          </button>
        </div>
      </div>
    </div>
  )
} 